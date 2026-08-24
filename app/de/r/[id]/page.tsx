import { notFound } from 'next/navigation';
import { report } from '@/lib/store';
import { ReportView } from '@/components/ReportView';

export default async function GermanReport({ params }: { params: Promise<{ id: string }> }) {
  const item = await report((await params).id);
  if (!item) notFound();
  return <ReportView report={item} locale="de"/>;
}
