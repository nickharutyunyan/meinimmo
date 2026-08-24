import Link from 'next/link';
import { Brand } from '@/components/Brand';

export default function NotFound() {
  return <main className="simple-state"><Brand locale="de"/><p className="eyebrow">404</p><h1>Diese Seite gibt es nicht.</h1><p>Vielleicht wurde der Immobilien-Bericht oder Vergleich entfernt.</p><Link href="/de">Neuen Bericht erstellen</Link></main>;
}
