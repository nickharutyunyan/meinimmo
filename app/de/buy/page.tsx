import { BuyHubPage, buyMetadata } from '@/components/market/pages';

export const dynamic = 'force-dynamic';
export const metadata = buyMetadata('de');

export default function Page() { return <BuyHubPage locale="de" />; }
