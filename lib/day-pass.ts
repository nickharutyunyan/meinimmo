export type DayPassAccess = {
  limitsEnabled?: boolean;
  kind: string;
  limit: number;
  used: number;
  remaining: number;
};

export function canOfferDayPass(access?: DayPassAccess | null) {
  return Boolean(
    access
    && access.limitsEnabled !== false
    && access.kind === 'free'
    && access.limit === 2
    && access.used >= access.limit
    && access.remaining === 0
  );
}
