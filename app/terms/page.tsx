import type { Metadata } from 'next';
import { TermsPage } from '@/components/TermsPage';

export const metadata: Metadata = { title: 'Terms | Review a House', robots: { index: true, follow: true } };
export default function Terms() { return <TermsPage locale="en" />; }
