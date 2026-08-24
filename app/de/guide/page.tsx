import type { Metadata } from 'next';
import GuideIndex from '../../../components/GuideIndex';

export const metadata: Metadata = {
  title: 'Guide | Review a House',
  description: 'Konkrete und belegte Notizen zu deutschen Kiezen, Immobilienmärkten und Stadtstraßen.',
  alternates: { canonical: '/de/guide', languages: { de: '/de/guide', en: '/guide' } },
};

export default function Page() { return <GuideIndex locale="de" />; }
