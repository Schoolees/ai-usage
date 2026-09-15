import { useEffect, useState } from 'react';
import type { Api, DisplayOption, ProviderOption } from '../../shared/ipc';
import { providerSettings, type Settings, type SettingsPatch } from '../../shared/settings-schema';
import { NumberInput } from './NumberInput';

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

export function SettingsApp({ api = window.api }: { api?: Api }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [displays, setDisplays] = useState<DisplayOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.getSettings(), api.getProviders(), api.getDisplays()]).then(([s, p, d]) => {
      setSettings(s);
      setProviders(p);
      setDisplays(d);
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

  return (
    <main className="settings">
      <h1>AI Usage settings</h1>

      <section>
        <h2>Providers</h2>
        {providers.map((provider) => {
          const current = providerSettings(settings, provider.id);
          return (
            <fieldset key={provider.id}>
              <label className="check">
                <input type="checkbox" checked={current.enabled} onChange={(e) => void saveProvider(provider.id, { enabled: e.target.checked })} />
                {provider.name}
              </label>
              <div className="field">
                <span>Source</span>
                <select
                  aria-label={`${provider.name} source`}
                  value={current.sourceHome ?? ''}
                  onChange={(e) => void saveProvider(provider.id, { sourceHome: e.target.value || null })}
                >
                  <option value="">Automatic (most recently used)</option>
                  {provider.sources.map((source) => (
                    <option key={source.home} value={source.home}>
                      {source.label} — {source.home}
                    </option>
                  ))}
                </select>
              </div>
              {provider.sources.length === 0 && <p className="hint">Not found on Windows or running WSL distros.</p>}
            </fieldset>
          );
        })}
      </section>

      <section>
        <h2>Island</h2>
        <div className="field">
          <span>Display</span>
          <select
            aria-label="Display"
            value={settings.displayId ?? ''}
            onChange={(e) => void save({ displayId: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Primary display</option>
            {displays.map((display) => (
              <option key={display.id} value={display.id}>
                {display.label}
                {display.primary ? ' (primary)' : ''}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.hideInFullscreen} onChange={(e) => void save({ hideInFullscreen: e.target.checked })} />
          Hide when a fullscreen app is in front
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.openAtLogin} onChange={(e) => void save({ openAtLogin: e.target.checked })} />
          Start with Windows
        </label>
      </section>

      <section>
        <h2>Alerts</h2>
        <label className="check">
          <input type="checkbox" checked={settings.alertsEnabled} onChange={(e) => void save({ alertsEnabled: e.target.checked })} />
          Show notifications
        </label>
        <NumberInput label="Warning at (%)" value={settings.warnPercent} min={1} max={99} onCommit={(v) => void save({ warnPercent: v })} />
        <NumberInput label="Critical at (%)" value={settings.criticalPercent} min={2} max={100} onCommit={(v) => void save({ criticalPercent: v })} />
      </section>

      <section>
        <h2>Refresh</h2>
        <NumberInput
          label="Check Claude every (minutes)"
          value={settings.claudeRefreshMs / 60_000}
          min={1}
          max={60}
          onCommit={(v) => void save({ claudeRefreshMs: v * 60_000 })}
        />
        <p className="hint">Codex is read from local logs every 30 seconds.</p>
      </section>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  );
}
