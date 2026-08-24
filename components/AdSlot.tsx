import { copy, type Locale } from '@/lib/i18n';

export function AdSlot({ locale, kind = 'local', compact = false }: { locale: Locale; kind?: 'finance' | 'local'; compact?: boolean }) {
  const text = copy[locale].ads;
  return <aside className={`ad-slot${compact ? ' compact' : ''}`} aria-label={locale === 'de' ? 'Werbeplatz' : 'Advertising space'}>
    <span>{text.partner}</span>
    <strong>{text[kind]}</strong>
    <p>{text.note}</p>
  </aside>;
}
