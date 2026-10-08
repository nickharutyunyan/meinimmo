const BERLIN = 'Europe/Berlin';

/** Calendar date in Europe/Berlin, `YYYY-MM-DD`. */
export function berlinDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function berlinOffsetMinutes(instant: Date) {
  const offset = new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN, timeZoneName: 'longOffset', hour: '2-digit' })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value
    .match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!offset) return 60;
  return (offset[1] === '+' ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3]));
}

/** UTC instant of 00:00 on a Berlin calendar day. Midnight is never the DST gap. */
function berlinMidnightUtc(year: number, month: number, day: number) {
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstOffset = berlinOffsetMinutes(new Date(utcMidnight));
  const corrected = berlinOffsetMinutes(new Date(utcMidnight - firstOffset * 60_000));
  return new Date(utcMidnight - corrected * 60_000);
}

/** Start of the next Europe/Berlin calendar day, as a UTC ISO timestamp. */
export function nextBerlinMidnight(date = new Date()) {
  const [year, month, day] = berlinDay(date).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return berlinMidnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()).toISOString();
}
