import { SiteNav } from '@/components/SiteNav';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata = { title: 'Chrome Listing Helper — ReviewAHouse', robots: { index: false, follow: false } };
export default function BrowserHelperPage() {
  return <main className="landing country-landing helper-setup">
    <SiteNav locale="en" country="AM"/>
    <section className="helper-guide">
      <p className="eyebrow">Desktop Chrome · Early-access helper</p>
      <h1>Your browser.<br/><em>Your next property report.</em></h1>
      <p>Some listing sites block our server. This small helper reads the public listing through Chrome when you click Create report. Set it up once, then just paste a link.</p>
      <a className="primary-button" href="/downloads/reviewahouse-helper.zip" download>Download browser helper ↓</a>
      <h2>One-time setup</h2>
      <ol>
        <li>Download and unzip the helper. Keep the extracted folder somewhere permanent.</li>
        <li>In Chrome, open <code>chrome://extensions</code> and enable <strong>Developer mode</strong>.</li>
        <li>Click <strong>Load unpacked</strong> and select the extracted folder containing <code>manifest.json</code>.</li>
        <li>Refresh <a href="/am">the Armenia page</a> in Chrome. Look for “Browser helper connected”, then paste your List.am link.</li>
      </ol>
      <p>This is a local prototype, not a Chrome Web Store release. It works in the Chrome profile where you install it—not in an embedded browser or on mobile.</p>
      <h2>Small permissions. One job.</h2>
      <p>Access is limited to List.am and ReviewAHouse. The helper reads the listing’s public title, price, location, description and property fields. It does not read passwords, cookies, browsing history or other websites.</p>
      <p>A temporary listing tab opens only after you submit a report. It closes once read. If List.am requests a security check, complete it yourself in that tab and retry. The helper does not bypass verification.</p>
      <p>Listing text goes to ReviewAHouse to create your saved, shareable report. Remove or disable the helper at <code>chrome://extensions</code> whenever you like. Source-site terms still apply; installing it does not grant reuse rights.</p>
      <a href="/am">← Back to Armenia reports</a>
    </section>
    <SiteFooter locale="en"/>
  </main>;
}
