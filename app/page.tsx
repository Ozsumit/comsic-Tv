// app/page.tsx
import { fetchAndParsePlaylist } from "@/lib/playlists";
import CosmicTVClient from "@/components/comsic"; // Adjust path as needed

// This ensures the fetch runs at build time (or when revalidated)
export const dynamic = "force-dynamic";

export default async function Page() {
  const channels = await fetchAndParsePlaylist();

  return <CosmicTVClient initialChannels={channels} />;
}
