import type { Metadata } from 'next';
import { TermsPage } from '@/components/TermsPage';

export const metadata: Metadata = { title: 'Nutzungsbedingungen | Review a House', robots: { index: true, follow: true } };
export default function GermanTerms() { return <TermsPage locale="de" />; }
