import type { Metadata } from 'next';
import { ResetPasswordPage } from '@/components/ResetPasswordPage';

export const metadata: Metadata = { title: 'Passwort zurücksetzen | ReviewAHouse', robots: { index: false, follow: false } };
export default function Page() { return <ResetPasswordPage locale="de" />; }
