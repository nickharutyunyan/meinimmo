import { CityPage, cityMetadata, cityParams } from '@/components/market/pages';

export const dynamicParams = false;
export const generateStaticParams = cityParams;

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props) { return cityMetadata('en', (await params).city); }

export default async function Page({ params }: Props) { return <CityPage locale="en" slug={(await params).city} />; }
