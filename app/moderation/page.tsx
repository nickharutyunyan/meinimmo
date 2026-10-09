import type { Metadata } from 'next';
import { MarketNav } from '@/components/market/MarketNav';
import { ModerationQueue } from '@/components/market/ModerationQueue';

export const metadata: Metadata = { title: 'Moderation | Review a House', robots: { index: false, follow: false } };

export default function Page() {
  return <div className="market-page">
    <MarketNav locale="en" />
    <ModerationQueue />
  </div>;
}
