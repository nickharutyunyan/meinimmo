import type { Metadata } from 'next';
import { ForgotPasswordPage } from '@/components/ForgotPasswordPage';

export const metadata: Metadata = { title: 'Forgot password | ReviewAHouse', robots: { index: false, follow: false } };
export default function Page() { return <ForgotPasswordPage locale="en" />; }
