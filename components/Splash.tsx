import { ISpin } from "./icons";

export default function Splash({ text }: { text: string }) {
  return (
    <div className="mg-splash">
      <ISpin size={22} />
      <span>{text}</span>
    </div>
  );
}
