import { notFound } from 'next/navigation';
import { cache } from 'react';
import { report } from '@/lib/store';
import { reportPageMetadata } from '@/lib/page-meta';
import { ReportView } from '@/components/ReportView';
import { ArmeniaReport } from '@/components/ArmeniaReport';

const getReport = cache(report);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const item = await getReport((await params).id);
  if (!item) return {};
  if (item.country === 'AM') {
    return {
      title: `${item.title} — ReviewAHouse`,
      description: 'Armenia property report with listing facts, AMD pricing and financing.',
      alternates: { canonical: `/r/${item.id}` },
      openGraph: { title: `${item.title} — ReviewAHouse`, description: 'Armenia property report with listing facts and AMD pricing.', url: `/r/${item.id}` },
    };
  }
  return reportPageMetadata(item, 'en');
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const item = await getReport((await params).id);
  if (!item) notFound();
  return item.country === 'AM' ? <ArmeniaReport report={item} /> : <ReportView report={item} locale="en" />;
}
