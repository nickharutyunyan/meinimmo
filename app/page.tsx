import { LandingPage } from '@/components/LandingPage';

export default function Home() {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ReviewAHouse',
    alternateName: ['Review a House', 'reviewahouse.com'],
    url: 'https://reviewahouse.com/',
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, '\\u003c') }} />
    <LandingPage locale="en" />
  </>;
}
