interface SwitchProps {
  id: string;
  checked: boolean;
  onChange(checked: boolean): void;
}

/** Toggle switch; label it with `<label htmlFor={id}>`. */
export function Switch({ id, checked, onChange }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" aria-hidden />
    </button>
  );
}
