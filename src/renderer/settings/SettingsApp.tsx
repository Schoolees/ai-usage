import { ArrowUpCircle, Bell, Gauge, PanelTop, Plug, RefreshCw, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode, type UIEvent } from 'react';
import type { Api, DisplayOption, ProviderOption } from '../../shared/ipc';
import { sourceLabelFromHome } from '../../shared/format';
import { providerSettings, type Settings, type SettingsPatch } from '../../shared/settings-schema';
import { NumberInput } from './NumberInput';
import { Select } from './Select';
import { Switch } from './Switch';

/**
 * IPC errors arrive as Electron's raw "Error invoking remote method '...': ZodError: [...]"
 * text. Pull out the zod issue's own message when present, otherwise just strip Electron's prefix.
 */
export function cleanErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const zodMessage = /"message":"([^"]+)"/.exec(raw);
  if (zodMessage) return zodMessage[1];
  return raw.replace(/^Error invoking remote method '[^']*': /, '');
}

const SECTIONS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: 'providers', title: 'Providers', icon: Plug },
  { id: 'island', title: 'Island', icon: PanelTop },
  { id: 'alerts', title: 'Alerts', icon: Bell },
  { id: 'refresh', title: 'Refresh', icon: RefreshCw },
  { id: 'updates', title: 'Updates', icon: ArrowUpCircle },
];

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  claude: 'Plan limits from your Claude Code login.',
  codex: 'Plan limits from Codex CLI session logs.',
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="section-title">
        {title}
      </h2>
      <div className="card">{children}</div>
    </section>
  );
}

function SwitchRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange(value: boolean): void }) {
  const id = useId();
  return (
    <div className="row">
      <div className="row-text">
        <label className="row-label" htmlFor={id}>
          {label}
        </label>
        {description && <p className="row-desc">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

function SelectRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-label">{label}</span>
        {description && <p className="row-desc">{description}</p>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

export function SettingsApp({ api = window.api }: { api?: Api }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [displays, setDisplays] = useState<DisplayOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    void Promise.all([api.getSettings(), api.getProviders(), api.getDisplays(), api.getAppInfo()]).then(([s, p, d, info]) => {
      setSettings(s);
      setProviders(p);
      setDisplays(d);
      setVersion(info.version);
    });
  }, [api]);

  if (!settings) return <p className="loading">Loading…</p>;

  const save = async (patch: SettingsPatch) => {
    try {
      setSettings(await api.setSettings(patch));
      setError(null);
    } catch (e) {
      setError(cleanErrorMessage(e));
      // The patch was rejected, so re-fetch to revert any NumberInput draft to the saved value.
      setSettings(await api.getSettings());
    }
  };

  const saveProvider = (id: string, change: Partial<Settings['providers'][string]>) =>
    save({ providers: { ...settings.providers, [id]: { ...providerSettings(settings, id), ...change } } });

  // Highlight the last section whose heading has scrolled to the top of the content area.
  const trackActiveSection = (event: UIEvent<HTMLElement>) => {
    const content = event.currentTarget;
    const top = content.getBoundingClientRect().top + 48;
    let current = SECTIONS[0].id;
    for (const { id } of SECTIONS) {
      const section = document.getElementById(id);
      if (section && section.getBoundingClientRect().top <= top) current = id;
    }
    setActive(current);
  };

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="drag-strip">
          <Gauge size={14} aria-hidden />
          <span>AI Usage</span>
        </div>
        {version && <p className="sidebar-version">Version {version}</p>}
        <nav aria-label="Settings sections">
          {SECTIONS.map(({ id, title, icon: Icon }) => (
            <button key={id} type="button" className={active === id ? 'nav-item active' : 'nav-item'} aria-current={active === id} onClick={() => goTo(id)}>
              <Icon size={16} aria-hidden />
              {title}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main">
        <div className="drag-strip">
          <button type="button" className="window-close" aria-label="Close" onClick={() => window.close()}>
            <X size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <main className="content" onScroll={trackActiveSection}>
        <h1 className="page-title">Settings</h1>

        <Section id="providers" title="Providers">
          {providers.map((provider) => {
            const current = providerSettings(settings, provider.id);
            const options = [
              { value: '', label: 'Automatic (most recently used)' },
              ...provider.sources.map((source) => ({ value: source.home, label: source.label, detail: source.home })),
            ];
            // A saved source can be missing after a restart (e.g. its WSL distro isn't running yet).
            // Keep it selected and visible instead of falling back to a blank "Select…".
            const configuredMissing = current.sourceHome !== null && !provider.sources.some((s) => s.home === current.sourceHome);
            if (configuredMissing && current.sourceHome) {
              options.push({ value: current.sourceHome, label: `${sourceLabelFromHome(current.sourceHome)} — not available`, detail: current.sourceHome });
            }
            const activeLabel = provider.sources.find((s) => s.home === provider.activeHome)?.label;
            const description = configuredMissing
              ? `Your chosen source is not available right now${activeLabel ? `, so it is using ${activeLabel}` : ' and no other source was found'}.`
              : provider.sources.length === 0
                ? 'Not found on Windows or running WSL distros.'
                : 'Where to read the login or logs from.';
            return (
              <div key={provider.id} className="group">
                <SwitchRow
                  label={provider.name}
                  description={PROVIDER_DESCRIPTIONS[provider.id]}
                  checked={current.enabled}
                  onChange={(enabled) => void saveProvider(provider.id, { enabled })}
                />
                <SelectRow label="Source" description={description}>
                  <Select
                    label={`${provider.name} source`}
                    value={current.sourceHome ?? ''}
                    options={options}
                    onChange={(sourceHome) => void saveProvider(provider.id, { sourceHome: sourceHome || null })}
                  />
                </SelectRow>
              </div>
            );
          })}
        </Section>

        <Section id="island" title="Island">
          <SelectRow label="Display" description="Which screen the island hangs from.">
            <Select
              label="Display"
              value={settings.displayId === null ? '' : String(settings.displayId)}
              options={[
                { value: '', label: 'Primary display' },
                ...displays.map((display) => ({ value: String(display.id), label: `${display.label}${display.primary ? ' (primary)' : ''}` })),
              ]}
              onChange={(displayId) => void save({ displayId: displayId === '' ? null : Number(displayId) })}
            />
          </SelectRow>
          <SwitchRow
            label="Hide when a fullscreen app is in front"
            description="Get out of the way of videos, games and presentations."
            checked={settings.hideInFullscreen}
            onChange={(hideInFullscreen) => void save({ hideInFullscreen })}
          />
          <SwitchRow
            label="Start with Windows"
            description="Open AI Usage when you sign in."
            checked={settings.openAtLogin}
            onChange={(openAtLogin) => void save({ openAtLogin })}
          />
        </Section>

        <Section id="alerts" title="Alerts">
          <SwitchRow
            label="Show notifications"
            description="Notify when a limit crosses a threshold or resets."
            checked={settings.alertsEnabled}
            onChange={(alertsEnabled) => void save({ alertsEnabled })}
          />
          <NumberInput
            label="Warning at"
            description="Bars and the island turn amber."
            suffix="%"
            value={settings.warnPercent}
            min={1}
            max={99}
            onCommit={(v) => void save({ warnPercent: v })}
          />
          <NumberInput
            label="Critical at"
            description="Bars and the island turn red."
            suffix="%"
            value={settings.criticalPercent}
            min={2}
            max={100}
            onCommit={(v) => void save({ criticalPercent: v })}
          />
        </Section>

        <Section id="refresh" title="Refresh">
          <NumberInput
            label="Check Claude every"
            description="Codex is read from local logs every 30 seconds."
            suffix="min"
            value={settings.claudeRefreshMs / 60_000}
            min={1}
            max={60}
            onCommit={(v) => void save({ claudeRefreshMs: v * 60_000 })}
          />
        </Section>

        <Section id="updates" title="Updates">
          <SwitchRow
            label="Install updates automatically"
            description="Download new releases in the background and install them when you quit. The tray menu offers a restart as soon as one is ready."
            checked={settings.autoUpdate}
            onChange={(autoUpdate) => void save({ autoUpdate })}
          />
        </Section>

        {error && (
          <p role="alert" className="error">
            <TriangleAlert size={14} aria-hidden />
            {error}
          </p>
        )}
        </main>
      </div>
    </div>
  );
}
