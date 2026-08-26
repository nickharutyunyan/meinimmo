import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';
import type { Locale } from '@/lib/i18n';
import { GlossaryText } from './GlossaryText';

export function TermsPage({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const sections = de ? [
    ['1. Worum es hier geht', 'Review a House strukturiert Immobilienangebote, erstellt grobe Finanzierungsrechnungen und hilft beim Vergleichen. Der Dienst wird von Nick Harutyunyan betrieben. Diese Bedingungen gelten für die Nutzung der Website und deines Kontos.'],
    ['2. Kein Gutachten oder Beratung', 'Berichte, Scores, Karten, Fragen und Finanzierungsrechnungen sind eine erste Orientierung. Sie sind kein Verkehrswertgutachten, keine technische Prüfung und keine Rechts-, Steuer- oder Finanzberatung. Vor einem Kauf solltest du Angaben mit Originalunterlagen und passenden Fachleuten prüfen.'],
    ['3. Quellen und KI', 'Wir lesen Angaben aus verlinkten Angeboten und hochgeladenen Exposés. Manche Daten können fehlen, veraltet oder falsch beschrieben sein. Bei Lage und Rückfragen kann KI helfen, doch akzeptiert werden nur Angaben, die im Quelltext belegt sind. Bitte prüfe trotzdem immer das Originalangebot.'],
    ['4. Konten und faire Nutzung', 'Halte deine Zugangsdaten sicher und nutze den Dienst nicht automatisiert, missbräuchlich oder rechtswidrig. Die kostenlosen und bezahlten Limits gelten pro Person und Konto. Wir dürfen missbräuchliche Zugriffe begrenzen, wenn das für Sicherheit und Verfügbarkeit nötig ist.'],
    ['5. Zahlungen', 'Der Tagespass kostet einmalig 5 € und endet nach 24 Stunden automatisch. Pro kostet 10 € pro Monat, Ultra 20 € pro Monat. Abos verlängern sich monatlich, bis du sie im Stripe-Kundenportal kündigst; bei einer Kündigung bleibt der Zugang normalerweise bis zum Ende des bezahlten Zeitraums bestehen. Gesetzliche Rechte bleiben unberührt.'],
    ['6. Verfügbarkeit und Haftung', 'Wir möchten den Dienst zuverlässig anbieten, können aber keinen unterbrechungsfreien Betrieb oder vollständig fehlerfreie Ergebnisse garantieren. Soweit gesetzlich zulässig, haften wir nicht für Kaufentscheidungen oder Verluste, die allein auf einem Bericht beruhen. Für Vorsatz, grobe Fahrlässigkeit sowie Verletzungen von Leben, Körper oder Gesundheit gelten die gesetzlichen Regeln.'],
    ['7. Änderungen', 'Funktionen und diese Bedingungen können sich weiterentwickeln. Wesentliche Änderungen zeigen wir auf der Website an. Stand: 25. August 2026.'],
  ] : [
    ['1. What this service does', 'Review a House structures property listings, provides rough financing calculations and helps people compare homes. The service is operated by Nick Harutyunyan. These terms apply when you use the website or an account.'],
    ['2. Not a valuation or professional advice', 'Reports, scores, maps, questions and financing figures are an initial screening tool. They are not a formal valuation, building survey, or legal, tax or financial advice. Verify important facts against original documents and qualified professionals before buying.'],
    ['3. Sources and AI', 'We read information from linked listings and uploaded Exposés. Source information may be incomplete, outdated or wrong. AI can help identify stated locations and prepare questions, but location values are accepted only when supported by the source text. Always review the original listing.'],
    ['4. Accounts and fair use', 'Keep your account credentials secure and do not use the service unlawfully, abusively or through unauthorized automation. Free and paid limits apply per person and account. We may limit abusive access where necessary for security and availability.'],
    ['5. Payments', 'The day pass is a one-off €5 payment and ends automatically after 24 hours. Pro costs €10 per month and Ultra €20 per month. Subscriptions renew monthly until cancelled in the Stripe customer portal; access normally continues until the end of the paid period. Your statutory rights remain unaffected.'],
    ['6. Availability and liability', 'We aim to keep the service reliable, but cannot promise uninterrupted availability or completely error-free results. To the extent permitted by law, we are not responsible for a purchase decision or loss based solely on a report. Statutory liability remains for intent, gross negligence, and injury to life, body or health.'],
    ['7. Changes', 'The product and these terms may evolve. Material changes will be shown on the website. Effective: 25 August 2026.'],
  ];
  return <main className="terms-page" lang={locale}>
    <SiteNav locale={locale} />
    <article>
      <p className="eyebrow">{de ? 'KURZ & VERSTÄNDLICH' : 'PLAIN-LANGUAGE TERMS'}</p>
      <h1>{de ? 'Nutzungsbedingungen' : 'Terms of use'}</h1>
      <p className="terms-intro">{de ? 'Die wichtigsten Regeln ohne unnötiges Kleingedrucktes.' : 'The basic rules, without unnecessary legal fog.'}</p>
      {sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p><GlossaryText locale={locale}>{body}</GlossaryText></p></section>)}
    </article>
    <SiteFooter locale={locale} />
  </main>;
}
