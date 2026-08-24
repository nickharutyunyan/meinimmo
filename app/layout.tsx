import type { Metadata } from 'next';
import './globals.css';
import './sidebar.css';
import './report-extras.css';
import './assessment-details.css';
import './brand.css';
import './editorial.css';
import './guide.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://reviewahouse.com'),
  applicationName: 'Review a House',
  title: 'Review a House — Property clarity',
  description: 'Clear German property reports, comparisons and practical buyer guides.',
  alternates: { canonical: '/', languages: { en: '/', de: '/de' } },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
