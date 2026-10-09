import { CityPage, cityMetadata } from '@/components/market/pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props) { return cityMetadata('de', (await params).city); }

export default async function Page({ params }: Props) { return <CityPage locale="de" slug={(await params).city} />; }
