import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PrintReport } from '@/components/PrintReport';
import { acquisitionCosts } from '@/lib/finance';
import { printFinanceSettings } from '@/lib/print-finance';
import { report } from '@/lib/store';
import { printDocumentTitle } from '@/lib/print-title';

const getReport = cache(report);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const item = await getReport((await params).id);
  return { title: item ? printDocumentTitle(item, 'de') : 'Immobilien-Bericht · ReviewAHouse', robots: { index: false, follow: false } };
}

export default async function GermanPrintableReport({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const item = await getReport((await params).id);
  if (!item) notFound();
  const query = await searchParams;
  const finance = printFinanceSettings(query, acquisitionCosts(item.facts).total);
  return <PrintReport report={item} locale="de" finance={finance} autoPrint={query.print === '1'} />;
}
