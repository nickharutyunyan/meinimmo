import { notFound } from 'next/navigation';
import { comparison, report } from '@/lib/store';
import { ComparisonView } from '@/components/ComparisonView';
import { ArmeniaComparison } from '@/components/ArmeniaComparison';
export async function generateMetadata({params}:{params:Promise<{id:string}>}) {
  const item = await comparison((await params).id);
  const first = item ? await report(item.reportIds[0]) : undefined;
  return first?.country === 'AM' ? { title:'Armenia Property Comparison — ReviewAHouse', description:'Compare Armenian property facts and AMD asking prices side by side.', alternates:{canonical:`/c/${item!.id}`}, openGraph:{title:'Armenia Property Comparison — ReviewAHouse',description:'Compare Armenian property facts and AMD asking prices.',url:`/c/${item!.id}`} } : {};
}

export default async function Compare({ params }: { params: Promise<{ id: string }> }) {
  const item = await comparison((await params).id);
  if (!item) notFound();
  const [a, b] = await Promise.all(item.reportIds.map(report));
  if (!a || !b) notFound();
  if (a.country === 'AM' && b.country === 'AM') return <ArmeniaComparison first={a} second={b}/>;
  return <ComparisonView first={a} second={b} locale="en" />;
}
