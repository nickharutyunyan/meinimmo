import type { Metadata } from 'next';
import './globals.css';
import './sidebar.css';
import './report-extras.css';
import './assessment-details.css';
export const metadata: Metadata = { title: 'Habitat — Property clarity', description: 'Clear German property assessments.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
