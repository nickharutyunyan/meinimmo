import type { Metadata } from 'next';
import { TermsPage } from '@/components/TermsPage';

const title = 'Terms | Review a House';
const description = 'Terms of use for Review a House.';

export const metadata: Metadata = {
  title,
  description,
  robots: { index: true, follow: true },
  openGraph: { type: 'website', url: '/terms', siteName: 'ReviewAHouse', locale: 'en_GB', title, description },
  twitter: { card: 'summary', title, description },
};
export default function Terms() { return <TermsPage locale="en" />; }
