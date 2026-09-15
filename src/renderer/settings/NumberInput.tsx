import { useEffect, useId, useState } from 'react';

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onCommit(value: number): void;
}

/** Commits on blur or Enter so half-typed numbers are never saved. */
export function NumberInput({ value, min, max, label, onCommit }: NumberInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed === value) {
      setDraft(String(value));
      return;
    }
    onCommit(Math.min(max, Math.max(min, Math.round(parsed))));
  };

  return (
    <span className="number">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
      />
    </span>
  );
}
