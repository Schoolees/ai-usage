# Captures docs/screenshots/*.png from the running app: the island, the expanded panel, and the
# settings window. Run it on Windows with AI Usage running:
#
#   powershell -ExecutionPolicy Bypass -File scripts\screenshots.ps1
#
# It drives the real pointer (the island only expands on hover) and puts it back afterwards, so
# don't touch the mouse while it runs. The shots contain whatever your desktop and your plan usage
# look like at the time; check them before committing.
param([string]$Out = "docs\screenshots")

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Shot {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr p);
  delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);

  /** Close every settings window, so an already-open one cannot sit behind the island shots. */
  public static void CloseSettings(uint[] pids) {
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      var cls = new StringBuilder(64); GetClassName(h, cls, 64);
      if (cls.ToString() != "Chrome_WidgetWin_1") return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (Array.IndexOf(pids, pid) < 0) return true;
      RECT r; GetWindowRect(h, out r);
      if (r.Bottom - r.Top > 400) PostMessage(h, 0x0010, IntPtr.Zero, IntPtr.Zero); // WM_CLOSE
      return true;
    }, IntPtr.Zero);
  }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public MOUSEINPUT mi; }

  static void Send(int x, int y, uint flags) {
    int w = GetSystemMetrics(0), h = GetSystemMetrics(1);
    var i = new INPUT { type = 0, mi = new MOUSEINPUT { dx = x * 65535 / (w - 1), dy = y * 65535 / (h - 1), dwFlags = flags } };
    SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT)));
  }

  /** A real WM_MOUSEMOVE stream. SetCursorPos alone does not make the island think it is hovered. */
  public static void Glide(int toX, int toY, int steps) {
    POINT from; GetCursorPos(out from);
    for (int i = 1; i <= steps; i++) {
      Send(from.X + (toX - from.X) * i / steps, from.Y + (toY - from.Y) * i / steps, 0x0001 | 0x8000);
      System.Threading.Thread.Sleep(12);
    }
  }

  public static void Click(int x, int y) {
    Send(x, y, 0x0001 | 0x8000); System.Threading.Thread.Sleep(80);
    Send(x, y, 0x0002 | 0x8000); System.Threading.Thread.Sleep(40);
    Send(x, y, 0x0004 | 0x8000);
  }

  /** tall=false finds the island (short, pinned to the top edge); tall=true the settings window. */
  public static RECT Find(uint[] pids, bool tall) {
    RECT found = new RECT();
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      var cls = new StringBuilder(64); GetClassName(h, cls, 64);
      if (cls.ToString() != "Chrome_WidgetWin_1") return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (Array.IndexOf(pids, pid) < 0) return true;
      RECT r; GetWindowRect(h, out r);
      if (r.Right - r.Left > 100 && (r.Bottom - r.Top > 400) == tall) found = r;
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

function Save($left, $top, $width, $height, $path) {
  $bmp = New-Object Drawing.Bitmap $width, $height
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($left, $top, 0, 0, (New-Object Drawing.Size $width, $height))
  $bmp.Save((Resolve-Path $Out).Path + "\$path", [Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "$Out\$path  ${width}x${height}"
}

# Rest the pointer on the pill and keep nudging: one move is easy for the renderer to miss.
function Hover($island, $cx) {
  [Shot]::Glide($cx, ($island.Top + 120), 25)
  [Shot]::Glide($cx, ($island.Top + 14), 15)
  for ($i = 0; $i -lt 8; $i++) {
    [Shot]::Glide(($cx + 6), ($island.Top + 16), 2)
    [Shot]::Glide(($cx - 6), ($island.Top + 14), 2)
  }
}

if (-not (Test-Path $Out)) { New-Item -ItemType Directory -Path $Out | Out-Null }
$pids = [uint32[]](Get-Process -Name 'AI Usage' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
if (-not $pids) { throw 'AI Usage is not running.' }

$before = New-Object Shot+POINT
[void][Shot]::GetCursorPos([ref]$before)

[Shot]::CloseSettings($pids)
Start-Sleep -Milliseconds 800

$island = [Shot]::Find($pids, $false)
if ($island.Right -eq 0) { throw 'Island window not found. Is the island hidden?' }
$cx = [int](($island.Left + $island.Right) / 2)

# Collapsed pill, over a slice of the desktop it hangs from.
[Shot]::Glide(80, 700, 20)
Start-Sleep -Milliseconds 1500
Save ($cx - 500) $island.Top 1000 130 'island.png'

# Expanded panel.
Hover $island $cx
Start-Sleep -Milliseconds 400
Save ($cx - 470) $island.Top 940 350 'panel.png'

# Settings, opened from the panel's gear: bottom-right of the panel, inside the window's 32px/48px
# of transparent shadow padding.
Hover $island $cx
[Shot]::Glide(($island.Right - 54), ($island.Bottom - 160), 8)
[Shot]::Glide(($island.Right - 54), ($island.Bottom - 70), 8)
Start-Sleep -Milliseconds 300
[Shot]::Click(($island.Right - 54), ($island.Bottom - 70))
Start-Sleep -Seconds 3
# The island is always on top: move away so the panel collapses out of the settings shot.
[Shot]::Glide(80, 700, 20)
Start-Sleep -Seconds 2

$settings = [Shot]::Find($pids, $true)
if ($settings.Right -eq 0) { throw 'Settings window not found.' }
Save $settings.Left $settings.Top ($settings.Right - $settings.Left) ($settings.Bottom - $settings.Top) 'settings.png'

[Shot]::Glide($before.X, $before.Y, 10)
