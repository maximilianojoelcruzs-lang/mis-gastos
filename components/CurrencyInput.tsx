"use client";
import { useRef, useState } from "react";
import { clp, isPrivate } from "@/lib/format";

type Props = {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  "aria-label"?: string;
};

/** Campo de monto en pesos. Muestra siempre "$1.234" (sin cambiar al enfocarlo) y,
 *  con el modo privado activo, lo oculta mientras no lo estés editando. */
export default function CurrencyInput({ value, onChange, className, placeholder, autoFocus, onEnter, "aria-label": ariaLabel }: Props) {
  const [focused, setFocused] = useState(false);
  const fresh = useRef(false);
  const text = value > 0 ? (isPrivate() && !focused ? clp(value) : "$" + Math.round(value).toLocaleString("es-CL")) : "";
  return (
    <input
      className={className}
      inputMode="numeric"
      autoFocus={autoFocus}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={(e) => {
        // Al entrar se selecciona todo: lo que escribas reemplaza el monto.
        const el = e.currentTarget;
        fresh.current = true;
        setFocused(true);
        requestAnimationFrame(() => el.select());
      }}
      // Evita que el primer toque/clic mueva el cursor y deshaga la selección.
      onMouseUp={(e) => {
        if (fresh.current) e.preventDefault();
        fresh.current = false;
      }}
      onBlur={() => {
        fresh.current = false;
        setFocused(false);
      }}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
    />
  );
}
