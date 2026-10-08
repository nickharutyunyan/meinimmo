import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { comparison, report } from '@/lib/store';
import { comparisonPageMetadata } from '@/lib/page-meta';
import { ComparisonView } from '@/components/ComparisonView';

const getComparison = cache(comparison);
const getReport = cache(report);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const item = await getComparison((await params).id);
  if (!item) return {};
  const [first, second] = await Promise.all(item.reportIds.map(id => getReport(id)));
  if (!first || !second || (first.country === 'AM' && second.country === 'AM')) return {};
  return comparisonPageMetadata(first, second, item.id, 'de');
}

export default async function GermanCompare({ params }: { params: Promise<{ id: string }> }) {
  const item = await getComparison((await params).id);
  if (!item) notFound();
  const [first, second] = await Promise.all(item.reportIds.map(id => getReport(id)));
  if (!first || !second) notFound();
  if (first.country === 'AM' && second.country === 'AM') redirect(`/c/${item.id}`);
  return <ComparisonView first={first} second={second} locale="de" />;
}
