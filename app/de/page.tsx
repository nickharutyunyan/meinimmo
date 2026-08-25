import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'ReviewAHouse — Immobilienangebote prüfen & vergleichen',
  description: 'Prüfe deutsche Immobilienangebote mit klaren Berichten, Lage- und Energiedaten, direkten Vergleichen und einem anpassbaren Finanzierungsrechner.',
  alternates: { canonical: 'https://reviewahouse.com/de', languages: { en: 'https://reviewahouse.com', de: 'https://reviewahouse.com/de' } },
};

export default function GermanHome() {
  return <LandingPage locale="de" />;
}
