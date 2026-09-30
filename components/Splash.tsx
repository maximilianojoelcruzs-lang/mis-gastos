import { ISpin } from "./icons";

export default function Splash({ text }: { text: string }) {
  return (
    <div className="splash">
      <ISpin size={20} />
      <span>{text}</span>
    </div>
  );
}
