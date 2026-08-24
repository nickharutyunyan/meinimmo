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
export const metadata: Metadata = {
  metadataBase: new URL('https://reviewahouse.com'),
  applicationName: 'Review a House',
  title: 'Review a House — Property clarity',
  description: 'Clear German property reports, comparisons and practical buyer guides.',
  alternates: { canonical: '/', languages: { en: '/', de: '/de' } },
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
