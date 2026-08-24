import type { Metadata } from 'next';
import './globals.css';
import './sidebar.css';
import './report-extras.css';
import './assessment-details.css';
import './brand.css';
import './editorial.css';
export const metadata: Metadata = { applicationName: 'Good Homes', title: 'Good Homes — Property clarity', description: 'Clear German property assessments.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
