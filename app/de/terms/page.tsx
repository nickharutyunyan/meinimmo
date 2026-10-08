import type { Metadata } from 'next';
import { TermsPage } from '@/components/TermsPage';

const title = 'Nutzungsbedingungen | Review a House';
const description = 'Nutzungsbedingungen von Review a House.';

export const metadata: Metadata = {
  title,
  description,
  robots: { index: true, follow: true },
  openGraph: { type: 'website', url: '/de/terms', siteName: 'ReviewAHouse', locale: 'de_DE', title, description },
  twitter: { card: 'summary', title, description },
};
export default function GermanTerms() { return <TermsPage locale="de" />; }
