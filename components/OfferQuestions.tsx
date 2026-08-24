'use client';

import { useEffect, useState } from 'react';
import type { Report } from '@/lib/types';

export function OfferQuestions({ report }: { report: Report }) {
  const [questions, setQuestions] = useState(report.offerQuestions || []);
  const [tailored, setTailored] = useState(report.aiEnriched);
  const [loading, setLoading] = useState(!report.aiEnriched);

  useEffect(() => {
    if (report.aiEnriched) return;
    let active = true;
    fetch(`/api/reports/${report.id}/questions`, { method: 'POST' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.offerQuestions)) setQuestions(data.offerQuestions);
        setTailored(Boolean(data.aiEnriched));
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [report.aiEnriched, report.id]);

  return <section className="card offer-questions">
    <div className="section-heading">
      <p className="eyebrow">ASK BEFORE YOU OFFER</p>
      <span className={tailored ? 'ai-badge active' : 'ai-badge'}>{loading ? 'Reviewing…' : tailored ? 'AI tailored' : 'Essential checks'}</span>
    </div>
    <h2>Questions worth getting in writing</h2>
    <ol>{questions.map((question, index) => <li key={`${index}-${question}`}><span>{index + 1}</span><p>{question}</p></li>)}</ol>
    <small>Answers and supporting documents matter more than verbal assurances.</small>
  </section>;
}
