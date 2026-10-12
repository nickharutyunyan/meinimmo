import type { CSSProperties } from 'react';
import type { PriceBar } from '@/lib/price-check-copy';

const at = (value: number) => ({ '--at': `${value}%` }) as CSSProperties;

/**
 * Where the asking price per m² lands against the area's sales: below the range,
 * inside it, or above it. The sentence beside it says the same in words, so the
 * drawing itself is hidden from screen readers; the legend stays readable.
 */
export function PriceRangeBar({ bar, className = '' }: { bar: PriceBar; className?: string }) {
  const { range } = bar;
  return <figure className={['price-bar', bar.onMean ? 'is-on-mean' : '', range?.showEnds ? '' : 'no-ends', className].filter(Boolean).join(' ')}>
    <div className="price-bar-plot" aria-hidden="true">
      <span className={`price-bar-pin is-${bar.pinAlign}`} style={at(bar.asking)}>{bar.askingLabel}</span>
      <div className="price-bar-track">
        {range ? <>
          <span className="price-bar-zone is-below" style={{ width: `${range.low}%` }} />
          <span className="price-bar-zone is-range" style={{ left: `${range.low}%`, width: `${range.high - range.low}%` }} />
          <span className="price-bar-zone is-above" style={{ left: `${range.high}%` }} />
        </> : null}
        <span className="price-bar-mean" style={at(bar.mean)} />
        <span className="price-bar-dot" style={at(bar.asking)} />
      </div>
      {range?.showEnds ? <div className="price-bar-ends">
        <span className="is-low" style={at(range.low)}>{range.lowLabel}</span>
        <span className="is-high" style={at(range.high)}>{range.highLabel}</span>
      </div> : null}
    </div>
    <figcaption className="price-bar-legend">
      <span><i className="price-bar-key is-home" aria-hidden="true" />{bar.homeKey}</span>
      <span><i className="price-bar-key is-mean" aria-hidden="true" />{bar.meanKey}</span>
      {bar.rangeKey ? <span><i className="price-bar-key is-range" aria-hidden="true" />{bar.rangeKey}</span> : null}
    </figcaption>
  </figure>;
}
