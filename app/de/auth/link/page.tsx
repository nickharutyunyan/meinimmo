import type { Metadata } from 'next';
import { AuthLinkPage } from '@/components/AuthLinkPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Anmelden | Review a House', robots: { index: false, follow: false } };

export default function Page() {
  return <AuthLinkPage locale="de" />;
}
