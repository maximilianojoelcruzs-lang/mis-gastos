"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Dictado por voz con la API del navegador (Chrome, Edge y Safari). */
export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<any>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.abort?.();
  }, []);

  const start = useCallback(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    setError("");
    const r = new SR();
    r.lang = "es-CL";
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<any>).map((x) => x[0]?.transcript || "").join(" ").trim();
      if (text) cb.current(text);
    };
    r.onerror = (e: any) => {
      const code = e?.error;
      setError(
        code === "not-allowed" || code === "service-not-allowed" ? "Da permiso al micrófono para poder dictar."
          : code === "no-speech" ? "No te escuché. Inténtalo de nuevo."
            : code === "aborted" ? "" : `No se pudo dictar (${code || "error"}).`
      );
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => rec.current?.stop?.(), []);
  return { supported, listening, error, start, stop };
}
