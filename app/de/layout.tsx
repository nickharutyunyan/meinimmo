import type { Metadata } from 'next';
import { DocumentLocale } from '@/components/DocumentLocale';

const title = 'Review a House — Immobilienangebote prüfen und vergleichen';
const description = 'Prüfe deutsche Immobilienangebote mit klaren Berichten, Lage- und Energiedaten, direkten Vergleichen und einem anpassbaren Finanzierungsrechner.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { type: 'website', locale: 'de_DE', siteName: 'ReviewAHouse', title, description },
  twitter: { card: 'summary', title, description },
};

export default function GermanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><DocumentLocale locale="de" />{children}</>;
}
