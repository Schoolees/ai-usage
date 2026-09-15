import { useEffect, useId, useState } from 'react';

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  label: string;
  /** Unit shown after the field, e.g. "%" or "min" */
  suffix: string;
  description?: string;
  onCommit(value: number): void;
}

/** A settings row with a number field. Commits on blur or Enter so half-typed numbers are never saved. */
export function NumberInput({ value, min, max, label, suffix, description, onCommit }: NumberInputProps) {
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
    <div className="row">
      <div className="row-text">
        <label className="row-label" htmlFor={id}>
          {label}
        </label>
        {description && <p className="row-desc">{description}</p>}
      </div>
      <div className="number-field">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
        />
        <span className="number-suffix">{suffix}</span>
      </div>
    </div>
  );
}
