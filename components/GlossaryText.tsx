'use client';

import type { Locale } from '../lib/i18n';
import { glossaryPieces } from '../lib/glossary';
import { useTip } from './use-tip';

function GlossaryTerm({ text, explanation }: { text: string; explanation: string }) {
  const tip = useTip();
  return <span
    ref={(node) => {
      tip.rootRef.current = node;
      tip.triggerRef.current = node;
    }}
    className="glossary-term"
    role="button"
    tabIndex={0}
    aria-expanded={tip.open}
    aria-controls={tip.id}
    aria-describedby={tip.open ? tip.id : undefined}
    onPointerOver={tip.onPointerOver}
    onPointerLeave={tip.onPointerLeave}
    onPointerDown={tip.onPointerDown}
    onFocus={tip.onFocus}
    onBlur={tip.onBlur}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      tip.onActivate(event);
    }}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    }}
  >
    {text}
    <span className={tip.open ? 'glossary-tooltip is-open' : 'glossary-tooltip'} id={tip.id} role="tooltip">{explanation}</span>
  </span>;
}

export function GlossaryText({ children, locale }: { children: string; locale: Locale }) {
  return <>{glossaryPieces(children, locale).map((piece, index) => {
    if (!piece.explanation) return piece.text;
    return <GlossaryTerm key={`${piece.text}-${index}`} text={piece.text} explanation={piece.explanation} />;
  })}</>;
}
