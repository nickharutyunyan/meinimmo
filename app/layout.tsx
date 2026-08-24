import type { Metadata } from 'next';
import './globals.css';
import './sidebar.css';
export const metadata: Metadata = { title: 'Habitat — Property clarity', description: 'Clear German property assessments.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
