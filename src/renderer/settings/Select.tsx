import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary text, e.g. a folder path */
  detail?: string;
}

interface SelectProps {
  /** Accessible name of the trigger button */
  label: string;
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
}

/** Lists at least this long get a search box. */
const SEARCH_MIN_OPTIONS = 7;
/** Open upward when there is less room than this below the trigger. */
const POPOVER_SPACE_PX = 300;

/** Dropdown with a popover list: search for long lists, check on the selected option, full keyboard support. */
export function Select({ label, value, options, onChange }: SelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');

  const searchable = options.length >= SEARCH_MIN_OPTIONS;
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  const openList = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setPlacement(rect && window.innerHeight - rect.bottom < POPOVER_SPACE_PX && rect.top > window.innerHeight - rect.bottom ? 'up' : 'down');
    setQuery('');
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const pick = (option: SelectOption | undefined) => {
    if (!option) return;
    close(true);
    if (option.value !== value) onChange(option.value);
  };

  // Focus the search box (or the list) when opening, so the keyboard works straight away.
  useLayoutEffect(() => {
    if (!open) return;
    (searchable ? searchRef.current : listRef.current)?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault(); // keep Enter/Space from also firing a click that would close it again
      if (!open) openList();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(filtered.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        pick(filtered[activeIndex]);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close();
        break;
    }
  };

  const optionId = (index: number) => `${id}-option-${index}`;

  return (
    <div ref={rootRef} className="dropdown">
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dropdown-value">{selected?.label ?? 'Select…'}</span>
        <ChevronDown size={16} aria-hidden className="dropdown-chevron" />
      </button>

      {open && (
        <div className={`dropdown-popover ${placement}`}>
          {searchable && (
            <div className="dropdown-search">
              <Search size={14} aria-hidden />
              <input
                ref={searchRef}
                type="search"
                aria-label="Search options"
                aria-controls={`${id}-list`}
                aria-activedescendant={filtered.length > 0 ? optionId(activeIndex) : undefined}
                placeholder="Search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onListKeyDown}
              />
            </div>
          )}
          <div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            className="dropdown-list"
            aria-activedescendant={!searchable && filtered.length > 0 ? optionId(activeIndex) : undefined}
            onKeyDown={onListKeyDown}
          >
            {filtered.length === 0 && <p className="dropdown-empty">No matches</p>}
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={index === activeIndex ? 'dropdown-option active' : 'dropdown-option'}
                  onMouseMove={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option)}
                >
                  <span className="dropdown-option-text">
                    <span className="dropdown-option-label">{option.label}</span>
                    {option.detail && <span className="dropdown-option-detail">{option.detail}</span>}
                  </span>
                  {isSelected && <Check size={15} aria-hidden className="dropdown-check" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
