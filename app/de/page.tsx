import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'Review a House — Immobilien klarer sehen',
  description: 'Klare Immobilien-Berichte für Deutschland: Fakten, Lage, Finanzierung und Vergleich ohne Verkaufstext.',
  alternates: { canonical: 'https://reviewahouse.com/de', languages: { en: 'https://reviewahouse.com', de: 'https://reviewahouse.com/de' } },
};

export default function GermanHome() {
  return <LandingPage locale="de" />;
}
