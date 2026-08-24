import { notFound } from 'next/navigation';
import { comparison, report } from '@/lib/store';
import { ComparisonView } from '@/components/ComparisonView';

export default async function Compare({ params }: { params: Promise<{ id: string }> }) {
  const item = await comparison((await params).id);
  if (!item) notFound();
  const [a, b] = await Promise.all(item.reportIds.map(report));
  if (!a || !b) notFound();
  return <ComparisonView first={a} second={b} locale="en" />;
}
