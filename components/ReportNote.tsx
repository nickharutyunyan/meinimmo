'use client';

import { useEffect, useRef, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import { MAX_REPORT_NOTE_LENGTH } from '@/lib/report-note-validation';

type NoteResponse = { note?: string; updatedAt?: string | null; error?: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ReportNote({ reportId, locale }: { reportId: string; locale: Locale }) {
  const de = locale === 'de';
  const draftKey = `reviewahouse-note-draft:${reportId}`;
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const editedBeforeLoad = useRef(false);

  useEffect(() => {
    let active = true;
    const draft = localStorage.getItem(draftKey);
    fetch(`/api/reports/${encodeURIComponent(reportId)}/note`, { cache: 'no-store' })
      .then(async response => ({ response, result: await response.json() as NoteResponse }))
      .then(async ({ response, result }) => {
        if (!active) return;
        if (response.status === 401) {
          setAuthenticated(false);
          if (!editedBeforeLoad.current) setNote(draft ?? '');
          return;
        }
        if (!response.ok) throw new Error(result.error || 'load_failed');
        const serverNote = result.note || '';
        setAuthenticated(true);
        setSavedNote(serverNote);
        if (!editedBeforeLoad.current) setNote(draft ?? serverNote);
        const params = new URLSearchParams(window.location.search);
        if (!params.has('saveNote') || draft === null) return;
        setSaveState('saving');
        const saveResponse = await fetch(`/api/reports/${encodeURIComponent(reportId)}/note`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ note: draft }),
        });
        const saved = await saveResponse.json() as NoteResponse;
        if (!saveResponse.ok) throw new Error(saved.error || 'save_failed');
        if (!active) return;
        localStorage.removeItem(draftKey);
        setSavedNote(saved.note || '');
        setNote(saved.note || '');
        setSaveState('saved');
        params.delete('saveNote');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
      })
      .catch(() => {
        if (!active) return;
        if (!editedBeforeLoad.current) setNote(draft ?? '');
        setSaveState('error');
        setError(de ? 'Deine Notiz konnte gerade nicht geladen werden.' : 'Your note could not be loaded right now.');
      });
    return () => { active = false; };
  }, [de, draftKey, reportId]);

  function changeNote(value: string) {
    const next = value.slice(0, MAX_REPORT_NOTE_LENGTH);
    editedBeforeLoad.current = true;
    setNote(next);
    setGateOpen(false);
    setSaveState('idle');
    setError('');
    localStorage.setItem(draftKey, next);
  }

  async function save() {
    if (authenticated !== true) {
      localStorage.setItem(draftKey, note);
      setGateOpen(true);
      return;
    }
    setSaveState('saving');
    setError('');
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/note`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const result = await response.json() as NoteResponse;
    if (!response.ok) {
      if (response.status === 401) { setAuthenticated(false); localStorage.setItem(draftKey, note); setGateOpen(true); setSaveState('idle'); return; }
      setSaveState('error');
      setError(result.error || (de ? 'Speichern hat gerade nicht geklappt.' : 'The note could not be saved right now.'));
      return;
    }
    localStorage.removeItem(draftKey);
    setSavedNote(result.note || '');
    setNote(result.note || '');
    setSaveState('saved');
  }

  const returnTo = `${localePath(locale, `/r/${reportId}`)}?saveNote=1`;
  const accountPath = localePath(locale, '/account');
  const accountUrl = (mode: 'signup' | 'login') => `${accountPath}?mode=${mode}&returnTo=${encodeURIComponent(returnTo)}`;
  const dirty = note !== savedNote;

  return <section className="card private-note">
    <div className="private-note-heading">
      <div><p className="eyebrow">{de ? 'DEINE NOTIZ' : 'YOUR NOTE'}</p><h2>{de ? 'Gedanken zu dieser Immobilie' : 'Thoughts on this property'}</h2></div>
      <span className="private-label"><i aria-hidden="true">●</i>{de ? 'Nur für dich' : 'Private to you'}</span>
    </div>
    <label className="sr-only" htmlFor={`report-note-${reportId}`}>{de ? 'Private Notiz' : 'Private note'}</label>
    <textarea
      id={`report-note-${reportId}`}
      value={note}
      maxLength={MAX_REPORT_NOTE_LENGTH}
      onChange={event => changeNote(event.target.value)}
      placeholder={de ? 'Zum Beispiel: Fenster prüfen, Rücklage nachfragen …' : 'For example: check the windows, ask about the reserve …'}
    />
    <div className="private-note-actions">
      <small>{note.length.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')} / {MAX_REPORT_NOTE_LENGTH.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')}</small>
      <span aria-live="polite">{saveState === 'saved' ? (de ? 'Privat gespeichert ✓' : 'Saved privately ✓') : error}</span>
      <button type="button" onClick={save} disabled={saveState === 'saving' || (authenticated === true && !dirty)}>{saveState === 'saving' ? (de ? 'Speichert…' : 'Saving…') : (de ? 'Notiz speichern' : 'Save note')}</button>
    </div>
    {gateOpen ? <div className="note-auth-gate" role="dialog" aria-label={de ? 'Konto zum Speichern nötig' : 'Account required to save'}>
      <p><strong>{de ? 'Melde dich an, um die Notiz zu speichern.' : 'Sign in to save this note.'}</strong>{de ? ' Dein Entwurf bleibt in diesem Browser erhalten. Danach kommst du direkt hierher zurück – mit gespeicherter Notiz.' : ' Your draft is safe in this browser. Afterwards, you’ll come straight back here with the note saved.'}</p>
      <div><a className="note-signup" href={accountUrl('signup')}>{de ? 'Kostenloses Konto erstellen' : 'Create free account'}</a><a href={accountUrl('login')}>{de ? 'Anmelden' : 'Sign in'}</a></div>
    </div> : null}
  </section>;
}
