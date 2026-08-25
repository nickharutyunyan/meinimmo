'use client';

import { useEffect, useState } from 'react';
import type { Report } from '@/lib/types';
import { copy, type Locale } from '@/lib/i18n';
import { offerQuestionsFor, questionsAreConcise } from '@/lib/report-copy';
import { GlossaryText } from './GlossaryText';

export function OfferQuestions({ report, locale }: { report: Report; locale: Locale }) {
  const storedQuestions = locale === 'de' ? report.offerQuestionsDe : report.offerQuestions;
  const translatedQuestions = questionsAreConcise(storedQuestions) ? storedQuestions : offerQuestionsFor(report, locale);
  const [questions, setQuestions] = useState(translatedQuestions);
  const text = copy[locale].questions;
  const storedQuestionsAreCurrent = questionsAreConcise(report.offerQuestions) && questionsAreConcise(report.offerQuestionsDe);

  useEffect(() => {
    if (report.aiEnriched && storedQuestionsAreCurrent) return;
    let active = true;
    fetch(`/api/reports/${report.id}/questions`, { method: 'POST' })
      .then((response) => response.ok ? response.json() as Promise<{ offerQuestions?: string[]; offerQuestionsDe?: string[]; aiEnriched?: boolean }> : Promise.reject())
      .then((data) => {
        if (!active) return;
        const localized = locale === 'de' ? data.offerQuestionsDe : data.offerQuestions;
        if (Array.isArray(localized)) setQuestions(localized);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [locale, report.aiEnriched, report.id, storedQuestionsAreCurrent]);

  return <section className="card offer-questions">
    <p className="eyebrow">{text.label}</p>
    <h2>{text.title}</h2>
    <ol>{questions.map((question, index) => <li key={`${index}-${question}`}><span>{index + 1}</span><p><GlossaryText>{question}</GlossaryText></p></li>)}</ol>
  </section>;
}
