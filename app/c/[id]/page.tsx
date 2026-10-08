import { notFound } from 'next/navigation';
import { cache } from 'react';
import { comparison, report } from '@/lib/store';
import { comparisonPageMetadata } from '@/lib/page-meta';
import { ComparisonView } from '@/components/ComparisonView';
import { ArmeniaComparison } from '@/components/ArmeniaComparison';

const getComparison = cache(comparison);
const getReport = cache(report);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const item = await getComparison((await params).id);
  if (!item) return {};
  const [first, second] = await Promise.all(item.reportIds.map(id => getReport(id)));
  if (!first || !second) return {};
  if (first.country === 'AM' && second.country === 'AM') {
    return {
      title: 'Armenia Property Comparison — ReviewAHouse',
      description: 'Compare Armenian property facts and AMD asking prices side by side.',
      alternates: { canonical: `/c/${item.id}` },
      openGraph: { title: 'Armenia Property Comparison — ReviewAHouse', description: 'Compare Armenian property facts and AMD asking prices.', url: `/c/${item.id}` },
    };
  }
  return comparisonPageMetadata(first, second, item.id, 'en');
}

export default async function Compare({ params }: { params: Promise<{ id: string }> }) {
  const item = await getComparison((await params).id);
  if (!item) notFound();
  const [a, b] = await Promise.all(item.reportIds.map(id => getReport(id)));
  if (!a || !b) notFound();
  if (a.country === 'AM' && b.country === 'AM') return <ArmeniaComparison first={a} second={b}/>;
  return <ComparisonView first={a} second={b} locale="en" />;
}
