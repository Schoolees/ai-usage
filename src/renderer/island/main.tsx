import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { IslandView } from '../../shared/view-model';

function Debug() {
  const [view, setView] = useState<IslandView | null>(null);
  useEffect(() => {
    void window.api.getView().then(setView);
    return window.api.onView(setView);
  }, []);
  useEffect(() => window.api.resizeIsland(420, 260), []);
  return (
    <pre style={{ margin: 0, background: '#111', color: '#eee', font: '11px monospace', height: '100vh', overflow: 'auto' }}>
      {JSON.stringify(view?.providers.map((p) => ({ id: p.id, status: p.status, max: p.maxPercent, message: p.message })), null, 2)}
    </pre>
  );
}

createRoot(document.getElementById('root')!).render(<Debug />);
