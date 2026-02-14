import Image from "next/image";
import clsx from "clsx";

export function Logo({ size = 48, animated = false, className }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <div
      className={clsx("logo", animated && "logo-animated", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/logo.png" alt="Sin Pelos en el Micrófono" width={size} height={size} priority />
    </div>
  );
}
