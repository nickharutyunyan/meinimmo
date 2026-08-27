import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrintReport } from '@/components/PrintReport';
import { acquisitionCosts } from '@/lib/finance';
import { printFinanceSettings } from '@/lib/print-finance';
import { report } from '@/lib/store';

export const metadata: Metadata = { title: 'Printable property report — ReviewAHouse', robots: { index: false, follow: false } };

export default async function PrintableReport({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const item = await report((await params).id);
  if (!item) notFound();
  const query = await searchParams;
  const finance = printFinanceSettings(query, acquisitionCosts(item.facts).total);
  return <PrintReport report={item} locale="en" finance={finance} autoPrint={query.print === '1'} />;
}
