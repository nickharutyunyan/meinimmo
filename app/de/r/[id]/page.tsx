import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { report } from '@/lib/store';
import { cachedMortgageRate } from '@/lib/current-mortgage-rate';
import { reportPageMetadata } from '@/lib/page-meta';
import { ReportView } from '@/components/ReportView';

const getReport = cache(report);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const item = await getReport((await params).id);
  if (!item || item.country === 'AM') return {};
  return reportPageMetadata(item, 'de');
}

export default async function GermanReport({ params }: { params: Promise<{ id: string }> }) {
  const item = await getReport((await params).id);
  if (!item) notFound();
  if (item.country === 'AM') redirect(`/r/${item.id}`);
  const mortgageRate = await cachedMortgageRate();
  return <ReportView report={item} locale="de" mortgageRate={mortgageRate} />;
}
