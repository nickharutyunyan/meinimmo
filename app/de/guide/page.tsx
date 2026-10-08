import type { Metadata } from 'next';
import GuideIndex from '../../../components/GuideIndex';

const title = 'Guide | Review a House';
const description = 'Konkrete und belegte Notizen zu deutschen Kiezen, Immobilienmärkten und Stadtstraßen.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/de/guide', languages: { de: '/de/guide', en: '/guide' } },
  openGraph: { type: 'website', url: '/de/guide', siteName: 'ReviewAHouse', locale: 'de_DE', title, description },
  twitter: { card: 'summary', title, description },
};

export default function Page() { return <GuideIndex locale="de" />; }
