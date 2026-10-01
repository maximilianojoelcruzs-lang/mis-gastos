"use client";
import { useState } from "react";
import { MAX_TAGS, cleanTag } from "@/lib/data";
import { IX } from "./icons";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Etiquetas ya usadas, para sugerirlas. */
  suggestions?: string[];
  placeholder?: string;
};

/** Etiquetas libres: Enter, coma o espacio las agrega; las usadas antes se sugieren. */
export default function TagInput({ value, onChange, suggestions = [], placeholder = "Etiqueta (ej: viaje)" }: Props) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = cleanTag(raw);
    setText("");
    if (!t || value.includes(t) || value.length >= MAX_TAGS) return;
    onChange([...value, t]);
  };
  const q = cleanTag(text);
  const sug = suggestions.filter((s) => !value.includes(s) && (!q || s.startsWith(q))).slice(0, 5);

  return (
    <div className="taginput">
      <div className="taginput-box">
        {value.map((t) => (
          <span key={t} className="tag">
            #{t}
            <button type="button" aria-label={`Quitar etiqueta ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><IX size={11} /></button>
          </span>
        ))}
        {value.length < MAX_TAGS && (
          <input value={text} placeholder={value.length ? "" : placeholder} maxLength={30} aria-label="Agregar etiqueta"
            onChange={(e) => {
              const v = e.target.value;
              if (/[,\s]$/.test(v) && v.trim()) add(v);
              else setText(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                e.preventDefault();
                e.stopPropagation();
                add(text);
              } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
            }}
            onBlur={() => text.trim() && add(text)} />
        )}
      </div>
      {sug.length > 0 && value.length < MAX_TAGS && (
        <div className="tagsug">
          {sug.map((s) => (
            <button key={s} type="button" className="chip sm" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>#{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
