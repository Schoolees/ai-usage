/// <reference lib="dom" />
import { afterEach } from 'vitest';

// Component tests opt into jsdom per file; only those have a document to clean up.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
