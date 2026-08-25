export const MAX_REPORT_NOTE_LENGTH = 5_000;

export function validReportId(value: string) {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

export function normalizeReportNote(value: unknown) {
  if (typeof value !== 'string') throw new Error('invalid_note');
  const note = value.replace(/\r\n?/g, '\n');
  if (note.length > MAX_REPORT_NOTE_LENGTH) throw new Error('note_too_long');
  return note;
}
