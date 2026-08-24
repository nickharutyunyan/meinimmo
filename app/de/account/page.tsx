import type { Metadata } from 'next';
import { AccountPage } from '@/components/AccountPage';

export const metadata: Metadata = { title: 'Konto | Review a House', robots: { index: false, follow: false } };
export default function Page() { return <AccountPage locale="de" />; }
