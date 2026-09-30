"use client";
import { useEffect, type ReactNode } from "react";

type Props = { onClose: () => void; children: ReactNode; wide?: boolean; top?: boolean; label: string };

export default function Modal({ onClose, children, wide, top, label }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={"overlay " + (top ? "top" : "")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"modal " + (wide ? "wide" : "")} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
