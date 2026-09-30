"use client";
import { useState } from "react";
import { addProducts } from "@/lib/data";
import { parseShoppingList } from "@/lib/speech";
import type { AppData } from "@/lib/types";
import { IMic, IPlus } from "./icons";
import type { Notify, Update } from "./Tracker";
import { useDictation } from "./useDictation";

type Props = { data: AppData; update: Update; notify: Notify; size?: "sm" | "lg" };

/** Agrega varios productos de una vez, escritos o dictados: "leche, 2 panes y huevos". */
export default function AddMany({ update, notify, size = "sm" }: Props) {
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const list = parseShoppingList(raw);
    if (!list.length) return notify("No entendí ningún producto");
    update((d) => { addProducts(d.market, list); });
    notify("Agregué: " + list.map((p) => (p.qty > 1 ? `${p.name} x${p.qty}` : p.name)).join(", "));
    setText("");
  };

  const dict = useDictation((t) => add(t));
  const lg = size === "lg";

  return (
    <div>
      <div className="addmany">
        <input className={"field" + (lg ? "" : " sm")} value={text} maxLength={300}
          placeholder="Escribe o dicta: leche, 2 panes y huevos" aria-label="Agregar varios productos"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add(text)}
          style={lg ? { height: 44, fontSize: 16 } : undefined} />
        {dict.supported && (
          <button className={"btn " + (lg ? "" : "sm ") + (dict.listening ? "primary" : "")} onClick={dict.listening ? dict.stop : dict.start}
            aria-pressed={dict.listening} title={dict.listening ? "Escuchando…" : "Dictar por voz"} style={lg ? { height: 44 } : undefined}>
            <IMic size={15} /> {dict.listening ? "Escuchando…" : "Dictar"}
          </button>
        )}
        <button className={"btn " + (lg ? "" : "sm ")} onClick={() => add(text)} disabled={!text.trim()} style={lg ? { height: 44 } : undefined}>
          <IPlus size={14} /> Agregar
        </button>
      </div>
      {dict.error && <div className="muted" style={{ fontSize: 12, marginTop: 6, color: "var(--bad)" }} role="alert">{dict.error}</div>}
    </div>
  );
}
