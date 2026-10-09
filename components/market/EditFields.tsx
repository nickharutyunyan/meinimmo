'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

const groupFormat = (locale: 'en' | 'de', digits: number) => new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: digits });

/**
 * A number edited in place. It reads like the published figure until focused,
 * then shows plain digits so typing never fights the thousands separators.
 */
export function NumberField({ value, onCommit, locale, label, placeholder, digits = 0, prefix, suffix, className = '', id }: {
  value: number | null;
  onCommit: (value: number | null) => void;
  locale: 'en' | 'de';
  label: string;
  placeholder?: string;
  digits?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const shown = focused ? draft : value ? groupFormat(locale, digits).format(value) : '';
  const commit = () => {
    const cleaned = draft.replace(/\s/g, '').replace(locale === 'de' ? /\./g : /,/g, '').replace(',', '.');
    const parsed = cleaned === '' ? null : Number(cleaned);
    if (parsed === null || (Number.isFinite(parsed) && parsed >= 0)) {
      if (parsed !== value) onCommit(parsed === null ? null : Math.round(parsed * 10 ** digits) / 10 ** digits);
    }
  };
  return <span className={`ed-number ${className}`.trim()} data-empty={!shown || undefined}>
    {prefix ? <span className="ed-affix">{prefix}</span> : null}
    <input
      id={id}
      className="ed-field"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder || '—'}
      value={shown}
      onFocus={() => { setDraft(value ? String(value).replace('.', locale === 'de' ? ',' : '.') : ''); setFocused(true); }}
      onChange={event => setDraft(event.target.value.replace(/[^\d.,\s]/g, ''))}
      onBlur={() => { commit(); setFocused(false); }}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value ? String(value) : ''); event.currentTarget.blur(); } }}
    />
    {suffix ? <span className="ed-affix">{suffix}</span> : null}
  </span>;
}

/** One line of text edited in place; saves when the reader leaves the field or pauses typing. */
export function TextField({ value, onCommit, label, placeholder, maxLength = 80, className = '', id, list }: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  id?: string;
  list?: string;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  const flush = (next: string) => { window.clearTimeout(timer.current); if (next.trim() !== value) onCommit(next.trim()); };
  return <input
    id={id}
    className={`ed-field ${className}`.trim()}
    aria-label={label}
    placeholder={placeholder}
    maxLength={maxLength}
    value={draft}
    list={list}
    onFocus={() => { editing.current = true; }}
    onChange={event => {
      const next = event.target.value;
      setDraft(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(next), 900);
    }}
    onBlur={() => { editing.current = false; flush(draft); }}
    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
  />;
}

/** Paragraphs edited in place. Grows with its text so the page keeps its shape while typing. */
export function AreaField({ value, onCommit, label, placeholder, maxLength = 6000, className = '', id }: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const node = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  useEffect(() => {
    const area = node.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + 2}px`;
  }, [draft]);
  const flush = (next: string) => { window.clearTimeout(timer.current); if (next.trim() !== value.trim()) onCommit(next); };
  return <textarea
    id={id}
    ref={node}
    rows={1}
    className={`ed-field ed-area ${className}`.trim()}
    aria-label={label}
    placeholder={placeholder}
    maxLength={maxLength}
    value={draft}
    onFocus={() => { editing.current = true; }}
    onChange={event => {
      const next = event.target.value;
      setDraft(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(next), 1200);
    }}
    onBlur={() => { editing.current = false; flush(draft); }}
  />;
}
