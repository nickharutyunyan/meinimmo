import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import './sidebar.css';
import './report-extras.css';
import './assessment-details.css';
import './brand.css';
import './editorial.css';
import './guide.css';
import './account.css';
import './print-report.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://reviewahouse.com'),
  applicationName: 'ReviewAHouse',
  title: 'ReviewAHouse — German Property Reports & Comparisons',
  description: 'Analyze German real estate listings with clear property reports, location and energy facts, side-by-side comparisons, and an editable mortgage calculator.',
  alternates: { canonical: '/', languages: { en: '/', de: '/de' } },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ReviewAHouse',
    title: 'ReviewAHouse — German Property Reports & Comparisons',
    description: 'Analyze German real estate listings with clear reports, comparisons, location and energy facts, and an editable mortgage calculator.',
  },
  twitter: {
    card: 'summary',
    title: 'ReviewAHouse — German Property Reports & Comparisons',
    description: 'Analyze German real estate listings with clear reports, comparisons, location and energy facts, and an editable mortgage calculator.',
  },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-7NZBW8CKQ3" strategy="afterInteractive" />
    <Script id="google-analytics" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-7NZBW8CKQ3');
    `}</Script>
  </body></html>;
}
