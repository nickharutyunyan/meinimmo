import type { Metadata } from 'next';
import GuideIndex from '../../components/GuideIndex';

export const metadata: Metadata = {
  title: 'The Guide | Review a House',
  description: 'Specific, sourced field notes on German neighborhoods, housing markets and city streets.',
  alternates: { canonical: '/guide', languages: { de: '/de/guide', en: '/guide' } },
};

export default function Page() { return <GuideIndex locale="en" />; }
