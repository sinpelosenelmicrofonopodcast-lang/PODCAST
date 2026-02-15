import type { ReactNode } from "react";

export function Callout({
  variant,
  title,
  children
}: {
  variant: "hook" | "insight" | "ojo" | "corto";
  title?: string;
  children: ReactNode;
}) {
  const heading =
    title ??
    (variant === "hook" ? "Hook" : variant === "insight" ? "Insight" : variant === "ojo" ? "Ojo" : "En corto");
  return (
    <div className={`callout callout-${variant}`}>
      <div className="callout-title">{heading}</div>
      <div className="callout-body">{children}</div>
    </div>
  );
}

