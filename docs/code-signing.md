# Code signing

The installer is signed by [SignPath Foundation](https://signpath.org/), which issues free
certificates to open-source projects. Signing removes the "unknown publisher" wording from
Windows SmartScreen and lets electron-updater verify that an update really came from this project.

Signing happens in `.github/workflows/release.yml`, not on a developer machine: a Foundation
certificate may only sign artifacts that SignPath can trace back to a build it trusts, which here
means a GitHub Actions run in this repository.

## What the release workflow does

1. Builds the installer on `windows-latest` (`npx electron-builder --win --publish never`).
2. Uploads it as a build artifact and hands that artifact to SignPath.
3. Copies the signed installer back over `dist/`.
4. Runs `scripts/update-signed-metadata.mjs`, which rebuilds `latest.yml` and the `.blockmap`.
5. Fails the build unless `Get-AuthenticodeSignature` reports `Valid`.
6. Attaches the installer, its blockmap and `latest.yml` to the release for the tag.

Step 4 is not optional. Signing appends to the executable, so the SHA-512 electron-builder recorded
before signing no longer describes the file being shipped. electron-updater compares that hash
against what it downloads and rejects the update when they differ, which would break updates for
everyone already running the app.

Without the SignPath secrets the workflow still builds and publishes; it just skips signing, so
tagging a release keeps working while the application is in progress.

## Setting it up

1. **Apply.** Fill in the form on [signpath.org](https://signpath.org/) and email it in. The project
   has to be actively maintained, already released, under an OSI-approved licence with no
   proprietary components, and free of malware — this repository meets all of those.
2. **Create the project in SignPath** once accepted: a project for `ai-usage`, a signing policy
   (typically `release-signing`), and an artifact configuration for a single Authenticode file.
3. **Register this repository** as a trusted build system, so SignPath will accept artifacts from
   its GitHub Actions runs.
4. **Add the credentials** under Settings → Secrets and variables → Actions:

   | Kind     | Name                                    | Where it comes from                |
   |----------|-----------------------------------------|------------------------------------|
   | Secret   | `SIGNPATH_API_TOKEN`                    | SignPath user profile → API tokens |
   | Variable | `SIGNPATH_ORGANIZATION_ID`              | SignPath organization              |
   | Variable | `SIGNPATH_PROJECT_SLUG`                 | the project you created            |
   | Variable | `SIGNPATH_SIGNING_POLICY_SLUG`          | the signing policy                 |
   | Variable | `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`  | the artifact configuration         |

   The workflow turns signing on as soon as `SIGNPATH_API_TOKEN` exists.

5. **Release** by pushing a tag, as before:

   ```bash
   npm version 0.1.6 --no-git-tag-version
   git commit -am "chore(release): v0.1.6"
   git tag -a v0.1.6 -m "v0.1.6"
   git push origin main v0.1.6
   ```

   If you want hand-written release notes, create the release first and the workflow will upload the
   signed assets to it instead of generating notes.

6. **Say so in the README** once the first signed installer is out: drop the two notes about the
   installer being unsigned and SmartScreen warning on first run.

## What is signed, and what is not

Only the installer. That is what users download, what SmartScreen judges, and what electron-updater
verifies before installing an update.

The executables inside it — `AI Usage.exe`, `elevate.exe`, the generated uninstaller — are not
signed, because they are packed before the installer exists. Signing those as well means signing
`dist/win-unpacked` first, then rebuilding the installer from the signed files with
`electron-builder --win --prepackaged dist/win-unpacked`, and signing that. It needs a second
artifact configuration in SignPath; worth doing later, not needed for SmartScreen.

## Checking a release

```powershell
Get-AuthenticodeSignature .\ai-usage-setup-0.1.6.exe | Format-List
```

`Status` must be `Valid` and `SignerCertificate` must name SignPath Foundation. If a release ever
goes out with a stale `latest.yml`, installed copies log
`sha512 checksum mismatch` in `%APPDATA%\ai-usage\logs\main.log` and refuse to update.
