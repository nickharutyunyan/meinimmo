import type { Metadata } from 'next';
import { DocumentLocale } from '@/components/DocumentLocale';

export const metadata: Metadata = {
  openGraph: { locale: 'de_DE', siteName: 'ReviewAHouse' },
};

export default function GermanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><DocumentLocale locale="de" />{children}</>;
}
