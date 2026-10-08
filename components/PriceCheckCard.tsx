import type { Locale } from '@/lib/i18n';
import { priceCheckPresentation } from '@/lib/price-check-copy';
import type { Report } from '@/lib/types';

export function PriceCheckCard({ report, locale }: { report: Report; locale: Locale }) {
  const view = priceCheckPresentation(report, locale);
  if (view.kind === 'hidden') return null;
  return <section className="card price-check">
    <p className="eyebrow">{view.eyebrow}</p>
    {view.kind === 'unmatched' ? <p>{view.message}</p> : <>
      <p>{view.lead}</p>
      {view.positionNote ? <p>{view.positionNote}</p> : null}
      {view.notes.map((note) => <p className="price-check-note" key={note}>{note}</p>)}
      <p className="price-check-source"><a href={view.sourceUrl} target="_blank" rel="noreferrer">{view.sourceLabel}</a></p>
    </>}
  </section>;
}
