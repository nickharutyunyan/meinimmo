import type { Metadata } from 'next';
import { MethodPage } from '@/components/MethodPage';
import { methodCopy } from '@/lib/method-copy';

const page = methodCopy('en');

export const metadata: Metadata = {
  title: `${page.title} | Review a House`,
  description: page.description,
  alternates: { canonical: '/method', languages: { en: '/method', de: '/de/method' } },
  openGraph: { title: `${page.title} | Review a House`, description: page.description, url: '/method' },
};

export default function Method() {
  return <MethodPage locale="en" />;
}
