"use client";
import { clp } from "@/lib/format";
import type { Person } from "@/lib/types";
import { IUsers } from "./icons";

export type SplitValue = { paidBy: string; split: string[] };

type Props = { people: Person[]; value: SplitValue; onChange: (v: SplitValue) => void; amount: number };

/** ¿Lo compartes con alguien? ¿Quién pagó? Se divide en partes iguales. */
export default function SplitPicker({ people, value, onChange, amount }: Props) {
  if (!people.length) return null;
  const toggle = (id: string) => {
    const split = value.split.includes(id) ? value.split.filter((x) => x !== id) : [...value.split, id];
    onChange({ split, paidBy: split.includes(value.paidBy) ? value.paidBy : "" });
  };
  const parts = value.split.length + 1;
  const share = Math.round(amount / parts);
  const payer = people.find((p) => p.id === value.paidBy);

  return (
    <div className="splitpick">
      <div className="row-l">
        <span className="lbl"><IUsers size={13} /> Compartido con</span>
        <div className="chips">
          {people.map((p) => (
            <button key={p.id} type="button" className={"chip sm " + (value.split.includes(p.id) ? "on" : "")}
              aria-pressed={value.split.includes(p.id)} onClick={() => toggle(p.id)}>{p.name}</button>
          ))}
        </div>
      </div>
      {value.split.length > 0 && (
        <>
          <div className="row-l">
            <span className="lbl">Pagó</span>
            <div className="seg" role="group" aria-label="Quién pagó">
              <button type="button" className={value.paidBy === "" ? "on" : ""} onClick={() => onChange({ ...value, paidBy: "" })}>Yo</button>
              {people.filter((p) => value.split.includes(p.id)).map((p) => (
                <button key={p.id} type="button" className={value.paidBy === p.id ? "on" : ""} onClick={() => onChange({ ...value, paidBy: p.id })}>{p.name}</button>
              ))}
            </div>
          </div>
          {amount > 0 && (
            <p className="muted hint">
              Se divide en {parts}: tu parte es <b className="num">{clp(share)}</b>.{" "}
              {payer ? <>Le deberás {clp(share)} a {payer.name}.</> : <>Te deben {clp(amount - share)}.</>}
            </p>
          )}
        </>
      )}
    </div>
  );
}
