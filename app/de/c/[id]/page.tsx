import { notFound } from 'next/navigation';
import { comparison, report } from '@/lib/store';
import { ComparisonView } from '@/components/ComparisonView';
import { redirect } from 'next/navigation';

export default async function GermanCompare({ params }: { params: Promise<{ id: string }> }) {
  const item = await comparison((await params).id);
  if (!item) notFound();
  const [first, second] = await Promise.all(item.reportIds.map(report));
  if (!first || !second) notFound();
  if (first.country === 'AM' && second.country === 'AM') redirect(`/c/${item.id}`);
  return <ComparisonView first={first} second={second} locale="de" />;
}
