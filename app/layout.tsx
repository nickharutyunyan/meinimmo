import type { Metadata } from 'next';
import Script from 'next/script';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/figtree';
import './globals.css';
import './sidebar.css';
import './report-extras.css';
import './assessment-details.css';
import './brand.css';
import './editorial.css';
import './guide.css';
import './account.css';
import './print-report.css';
import './countries.css';
import './market.css';
import './theme.css';
import { ANALYTICS_CONFIG_SCRIPT } from '@/lib/identity/analytics';
export const metadata: Metadata = {
  metadataBase: new URL('https://reviewahouse.com'),
  applicationName: 'Review a House',
  title: 'Review a House — German Property Reports & Comparisons',
  description: 'Analyse German real estate listings with clear property reports, location and energy facts, side-by-side comparisons, and an editable mortgage calculator.',
  alternates: { canonical: '/', languages: { en: '/', de: '/de' } },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Review a House',
    locale: 'en_GB',
    title: 'Review a House — German Property Reports & Comparisons',
    description: 'Analyse German real estate listings with clear reports, comparisons, location and energy facts, and an editable mortgage calculator.',
  },
  twitter: {
    card: 'summary',
    title: 'Review a House — German Property Reports & Comparisons',
    description: 'Analyse German real estate listings with clear reports, comparisons, location and energy facts, and an editable mortgage calculator.',
  },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-7NZBW8CKQ3" strategy="afterInteractive" />
    <Script id="google-analytics" strategy="afterInteractive">{ANALYTICS_CONFIG_SCRIPT}</Script>
  </body></html>;
}
