export type ComparisonRow = readonly [label: string, first: string, second: string];

export function visibleComparisonRows<T extends ComparisonRow>(rows: readonly T[]) {
  return rows.filter(([, first, second]) => first !== '—' || second !== '—');
}
