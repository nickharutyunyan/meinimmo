'use client';

import { useId, type KeyboardEvent } from 'react';
import type { Locale } from '../lib/i18n';
import { glossaryPieces } from '../lib/glossary';

export function GlossaryText({ children, locale }: { children: string; locale: Locale }) {
  const id = useId();
  return <>{glossaryPieces(children, locale).map((piece, index) => {
    if (!piece.explanation) return piece.text;
    const tooltipId = `${id}-${index}`;
    return <span
      className="glossary-term"
      role="button"
      tabIndex={0}
      aria-describedby={tooltipId}
      key={`${piece.text}-${index}`}
      onClick={(event) => event.currentTarget.focus()}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.currentTarget.focus();
        }
      }}
    >
      {piece.text}
      <span className="glossary-tooltip" id={tooltipId} role="tooltip">{piece.explanation}</span>
    </span>;
  })}</>;
}
