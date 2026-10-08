import { notFound } from 'next/navigation';
import { report } from '@/lib/store';
import { ReportView } from '@/components/ReportView';
import { redirect } from 'next/navigation';

export default async function GermanReport({ params }: { params: Promise<{ id: string }> }) {
  const item = await report((await params).id);
  if (!item) notFound();
  if (item.country === 'AM') redirect(`/r/${item.id}`);
  return <ReportView report={item} locale="de"/>;
}
