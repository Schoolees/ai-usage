# Custom NSIS hooks. electron-builder includes this file automatically (buildResources/installer.nsh).

!macro customInstall
  # On an update electron-builder keeps the existing shortcuts instead of recreating them
  # (KeepShortcuts), so a Start Menu entry that has gone missing is never restored and the app
  # looks uninstalled after updating. addStartMenuLink has already run at this point, so this only
  # fills a gap; it never creates a second shortcut.
  ${ifNot} ${FileExists} "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${endIf}

  # Leftover "Apps & features" entry from the pre-0.1.1 appId (com.rpbaguio.ai-usage). An installer
  # only uninstalls the entry matching its own appId, so that one lingers and points at our
  # uninstaller, offering to remove a version that is no longer installed.
  DeleteRegKey SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Uninstall\ffbdc7f5-a1aa-53c3-bf03-d6cfe70434e5"
  DeleteRegKey SHELL_CONTEXT "Software\ffbdc7f5-a1aa-53c3-bf03-d6cfe70434e5"
!macroend
