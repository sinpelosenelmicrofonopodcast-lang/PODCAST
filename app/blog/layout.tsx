import type { ReactNode } from "react";
import "./platform-links.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}
