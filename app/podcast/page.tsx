import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PodcastPage() {
  // Feed is the single hub; Podcast is a view inside it (avoid redundant sections).
  redirect("/feed?view=episodes");
}
