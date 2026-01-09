// lib/playlist.ts

export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  isCustom?: boolean;
  isPinned?: boolean;
  score: number;
}

const FAST_DOMAINS = [
  "samsungtv",
  "pluto.tv",
  "rakuten",
  "plex",
  "tubi",
  "roku",
  "amagi",
  "mux",
];

const PINNED_KEYWORDS = [
  "fifa+",
  "red bull",
  "espn",
  "sky sport",
  "bein sport",
  "nasa",
  "formula 1",
];

const CUSTOM_CHANNELS: Partial<Channel>[] = [];

export async function fetchAndParsePlaylist(): Promise<Channel[]> {
  try {
    console.log("Fetching playlist from upstream...");

    // UPDATED FETCH LOGIC HERE:
    const res = await fetch(
      // 1. Add timestamp to URL to bypass GitHub/CDN caching
      `https://iptv-org.github.io/iptv/index.m3u?t=${Date.now()}`,
      {
        // 2. Disable Next.js Data Cache entirely
        cache: "no-store",
      }
    );

    if (!res.ok) throw new Error("Failed to fetch playlist");

    const text = await res.text();
    const lines = text.split("\n");
    const parsed: Channel[] = [];
    let name = "",
      logo = "",
      group = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#EXTINF")) {
        const n = line.match(/,(.*)$/);
        const l = line.match(/tvg-logo="(.*?)"/);
        const g = line.match(/group-title="(.*?)"/);
        name = n ? n[1].trim() : "Unknown";
        logo = l ? l[1] : "";
        group = g ? g[1] : "Uncategorized";
      }
      if (line.startsWith("http")) {
        let score = 0;
        const lowerUrl = line.toLowerCase();
        const lowerName = name.toLowerCase();

        let isPinned = false;
        if (PINNED_KEYWORDS.some((k) => lowerName.includes(k))) {
          isPinned = true;
          score += 2000;
        }

        if (FAST_DOMAINS.some((d) => lowerUrl.includes(d))) score += 50;
        if (line.startsWith("https")) score += 10;

        parsed.push({
          id: `${name}-${i}`,
          name,
          logo,
          group,
          url: line,
          score,
          isPinned,
        });
      }
    }

    const customs: Channel[] = CUSTOM_CHANNELS.map(
      (c, i) =>
        ({
          id: `custom-${i}`,
          name: c.name!,
          url: c.url!,
          logo: c.logo || "",
          group: c.group || "Custom",
          isCustom: true,
          score: 5000,
          isPinned: true,
        } as Channel)
    );

    return [...customs, ...parsed];
  } catch (err) {
    console.error("Error parsing playlist:", err);
    return [];
  }
}
