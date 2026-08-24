'use client';

import { useEffect, useState } from 'react';
import type { Report } from '@/lib/types';
import { copy, type Locale } from '@/lib/i18n';
import { offerQuestionsFor } from '@/lib/report-copy';

export function OfferQuestions({ report, locale }: { report: Report; locale: Locale }) {
  const translatedQuestions = locale === 'de' ? offerQuestionsFor(report, 'de') : (report.offerQuestions || offerQuestionsFor(report));
  const [questions, setQuestions] = useState(translatedQuestions);
  const [tailored, setTailored] = useState(locale === 'en' && report.aiEnriched);
  const [loading, setLoading] = useState(locale === 'en' && !report.aiEnriched);
  const text = copy[locale].questions;

  useEffect(() => {
    if (locale === 'de' || report.aiEnriched) return;
    let active = true;
    fetch(`/api/reports/${report.id}/questions`, { method: 'POST' })
      .then((response) => response.ok ? response.json() as Promise<{ offerQuestions?: string[]; aiEnriched?: boolean }> : Promise.reject())
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.offerQuestions)) setQuestions(data.offerQuestions);
        setTailored(Boolean(data.aiEnriched));
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [locale, report.aiEnriched, report.id]);

  return <section className="card offer-questions">
    <div className="section-heading">
      <p className="eyebrow">{text.label}</p>
      <span className={tailored ? 'ai-badge active' : 'ai-badge'}>{loading ? text.reviewing : tailored ? text.tailored : text.core}</span>
    </div>
    <h2>{text.title}</h2>
    <ol>{questions.map((question, index) => <li key={`${index}-${question}`}><span>{index + 1}</span><p>{question}</p></li>)}</ol>
    <small>{text.note}</small>
  </section>;
}
