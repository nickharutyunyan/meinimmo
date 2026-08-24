import Link from 'next/link';
import { Brand } from '@/components/Brand';

export default function NotFound() {
  return <main className="simple-state"><Brand/><p className="eyebrow">404</p><h1>This page isn’t here.</h1><p>The report or comparison may have been removed.</p><Link href="/">Create a new report</Link></main>;
}
