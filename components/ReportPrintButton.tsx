'use client';

import type { Locale } from '@/lib/i18n';

export function ReportPrintButton({ reportId, locale }: { reportId: string; locale: Locale }) {
  function openPrintReport() {
    const params = new URLSearchParams();
    params.set('print', '1');
    try {
      const saved = JSON.parse(sessionStorage.getItem(`reviewahouse-finance-${reportId}`) || '{}') as Record<string, unknown>;
      if (typeof saved.equity === 'number') params.set('equity', String(saved.equity));
      if (typeof saved.interest === 'number') params.set('interest', String(saved.interest));
      if (typeof saved.repayment === 'number') params.set('repayment', String(saved.repayment));
      if (typeof saved.includeHousegeld === 'boolean') params.set('hausgeld', saved.includeHousegeld ? '1' : '0');
    } catch {
      // The print report safely falls back to the calculator defaults.
    }
    const prefix = locale === 'de' ? '/de' : '';
    const query = params.size ? `?${params.toString()}` : '';
    window.open(`${prefix}/r/${reportId}/print${query}`, '_blank', 'noopener,noreferrer');
  }

  return <button className="print-report-button" onClick={openPrintReport} aria-label={locale === 'de' ? 'Druckansicht oder PDF öffnen' : 'Open print or PDF report'}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7V3.5h9V7M5 14H3.5V8.5h13V14H15m-9.5-3h9v5.5h-9z" /></svg>
    <span className="action-label-long">{locale === 'de' ? 'Drucken / PDF' : 'Print / PDF'}</span>
    <span className="action-label-short" aria-hidden="true">PDF</span>
  </button>;
}
