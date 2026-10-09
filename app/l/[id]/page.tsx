import { ListingPage, listingMetadata } from '@/components/market/pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) { return listingMetadata('en', (await params).id); }

export default async function Page({ params }: Props) { return <ListingPage locale="en" id={(await params).id} />; }
