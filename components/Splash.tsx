import { ISpin } from "./icons";
import Logo from "./Logo";

export default function Splash({ text }: { text: string }) {
  return (
    <div className="splash">
      <Logo size={72} className="pulse" />
      <ISpin size={18} />
      <span>{text}</span>
    </div>
  );
}
