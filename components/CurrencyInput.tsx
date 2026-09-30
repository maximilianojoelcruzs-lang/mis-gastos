"use client";
import { useState } from "react";
import { clp } from "@/lib/format";

type Props = { value: number; onChange: (n: number) => void; className?: string; placeholder?: string };

export default function CurrencyInput({ value, onChange, className, placeholder }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      className={className}
      inputMode="numeric"
      value={focused ? (value ? String(value) : "") : clp(value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
    />
  );
}
