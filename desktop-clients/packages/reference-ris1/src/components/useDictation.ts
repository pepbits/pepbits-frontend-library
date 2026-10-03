'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speech-to-text using the browser Web Speech API (Chrome, Edge, Safari).
 * Spoken punctuation and a few commands are converted before the text is delivered:
 *   "period" / "full stop", "comma", "colon", "semicolon", "question mark", "hyphen",
 *   "new line", "new paragraph", and the commands "next field" and "stop dictation".
 */
const PUNCT: [RegExp, string][] = [
  [/\s*\b(full stop|period)\b/gi, '.'],
  [/\s*\bcomma\b/gi, ','],
  [/\s*\bsemicolon\b/gi, ';'],
  [/\s*\bcolon\b/gi, ':'],
  [/\s*\bquestion mark\b/gi, '?'],
  [/\s*\bhyphen\b\s*/gi, '-'],
  [/\s*\bnew paragraph\b\s*/gi, '\n\n'],
  [/\s*\bnew line\b\s*/gi, '\n'],
  [/\bopen bracket\b\s*/gi, '('],
  [/\s*\bclose bracket\b/gi, ')'],
];

export function speechToText(raw: string, sentenceStart: boolean) {
  let t = raw;
  for (const [re, rep] of PUNCT) t = t.replace(re, rep);
  t = t.replace(/([.?]\s+|\n)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  if (sentenceStart) t = t.replace(/^\s*([a-z])/, (_, c) => c.toUpperCase());
  return t;
}

export function useDictation(opts: { onText: (text: string) => void; onCommand?: (cmd: 'next' | 'stop') => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<any>(null);
  const cb = useRef(opts);
  cb.current = opts;
  const wanted = useRef(false);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e: any) => {
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text: string = res[0].transcript;
        if (res.isFinal) {
          const lower = text.trim().toLowerCase();
          if (/^(stop dictation|stop listening)$/.test(lower)) { wanted.current = false; r.stop(); cb.current.onCommand?.('stop'); continue; }
          if (/^next (field|section)$/.test(lower)) { cb.current.onCommand?.('next'); continue; }
          cb.current.onText(text);
        } else partial += text;
      }
      setInterim(partial);
    };
    r.onerror = (e: any) => {
      if (e.error === 'no-speech') return;
      setError(e.error === 'not-allowed' ? 'Microphone access was blocked. Allow it in the browser address bar.' : `Speech recognition error: ${e.error}`);
      wanted.current = false;
    };
    r.onend = () => {
      setInterim('');
      if (wanted.current) { try { r.start(); } catch { /* already started */ } } else setListening(false);
    };
    rec.current = r;
    return () => { wanted.current = false; try { r.stop(); } catch { /* noop */ } };
  }, []);

  const start = useCallback(() => {
    if (!rec.current) return;
    setError(null);
    wanted.current = true;
    try { rec.current.start(); } catch { /* already running */ }
    setListening(true);
  }, []);
  const stop = useCallback(() => {
    wanted.current = false;
    try { rec.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop, toggle: () => (wanted.current ? stop() : start()) };
}
