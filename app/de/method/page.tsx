import type { Metadata } from 'next';
import { MethodPage } from '@/components/MethodPage';
import { methodCopy } from '@/lib/method-copy';

const page = methodCopy('de');

export const metadata: Metadata = {
  title: `${page.title} | Review a House`,
  description: page.description,
  alternates: { canonical: '/de/method', languages: { en: '/method', de: '/de/method' } },
  openGraph: { title: `${page.title} | Review a House`, description: page.description, url: '/de/method', locale: 'de_DE' },
};

export default function GermanMethod() {
  return <MethodPage locale="de" />;
}
