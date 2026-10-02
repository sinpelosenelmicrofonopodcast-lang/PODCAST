import { redirect } from "next/navigation";

export default function LegacyNewsroomLayout({ children: _children }: { children: React.ReactNode }) {
  redirect("/admin");
}
