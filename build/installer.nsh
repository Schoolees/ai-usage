# Custom NSIS hooks. electron-builder includes this file automatically (buildResources/installer.nsh).

!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
    # Per-user without asking, on the way in: AI Usage reads the signed-in user's CLI logins, and a
    # machine-wide install would need admin rights for every automatic update.
    # Only the first time, though. Going Back from the folder page runs this again, and skipping the
    # page a second time leaves nothing to go back to, so the installer would just quit. Showing it
    # then (with "Only for me" selected) gives Back somewhere sensible to land.
    Var /GLOBAL installModeSkipped
    ${if} $installModeSkipped != "1"
      StrCpy $installModeSkipped "1"
      StrCpy $isForceCurrentInstall "1"
    ${endif}
  !endif
!macroend

# electron-builder's own finish page, plus one change: an update skips it. electron-updater runs the
# installer visibly so the user can see progress, and without this every update would then sit on
# "Finish" until clicked, with the app closed.
!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function SkipFinishOnUpdate
    ${if} ${isUpdated}
      Call StartApp
      Abort
    ${endif}
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipFinishOnUpdate
  !insertmacro MUI_PAGE_FINISH
!macroend

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
