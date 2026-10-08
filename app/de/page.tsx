import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

const title = 'Review a House — Immobilienangebote prüfen & vergleichen';
const description = 'Prüfe deutsche Immobilienangebote mit klaren Berichten, Lage- und Energiedaten, direkten Vergleichen und einem anpassbaren Finanzierungsrechner.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://reviewahouse.com/de', languages: { en: 'https://reviewahouse.com', de: 'https://reviewahouse.com/de' } },
  openGraph: { type: 'website', url: '/de', siteName: 'ReviewAHouse', locale: 'de_DE', title, description },
  twitter: { card: 'summary', title, description },
};

export default function GermanHome() {
  return <LandingPage locale="de" />;
}
