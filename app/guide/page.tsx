import type { Metadata } from 'next';
import GuideIndex from '../../components/GuideIndex';

const title = 'The Guide | Review a House';
const description = 'Specific, sourced field notes on German neighbourhoods, housing markets and city streets.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/guide', languages: { de: '/de/guide', en: '/guide' } },
  openGraph: { type: 'website', url: '/guide', siteName: 'ReviewAHouse', locale: 'en_GB', title, description },
  twitter: { card: 'summary', title, description },
};

export default function Page() { return <GuideIndex locale="en" />; }
