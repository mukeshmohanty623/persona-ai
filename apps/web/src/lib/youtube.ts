import type { PersonaId } from "@/lib/prompts";

// ─────────────────────────────────────────────
// CHANNEL HANDLES
// ─────────────────────────────────────────────

const PERSONA_CHANNEL_HANDLES: Record<PersonaId, string[]> = {
  hitesh: ["HiteshCodeLab", "chaiaurcode"],
  piyush: ["piyushgargdev"],
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface YouTubeVideo {
  title: string;
  url: string;
  viewCount: number;
  thumbnail: string;
}

export interface YouTubeResult {
  found: true;
  top: YouTubeVideo;
  all: YouTubeVideo[];
}

export interface YouTubeNotFound {
  found: false;
  message: string;
}

// ─────────────────────────────────────────────
// RESOLVE CHANNEL HANDLES → IDs
// ─────────────────────────────────────────────

async function resolveChannelIds(
  handles: string[],
  apiKey: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const handle of handles) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/channels");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("forHandle", handle);
      url.searchParams.set("part", "id");

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.items?.[0]?.id) {
        ids.push(data.items[0].id);
      }
    } catch {
      // ignore individual handle failures
    }
  }
  return ids;
}

// ─────────────────────────────────────────────
// SEARCH WITHIN A CHANNEL
// ─────────────────────────────────────────────

async function searchInChannel(
  topic: string,
  channelId: string,
  apiKey: string,
  maxResults = 5,
): Promise<string[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("q", topic);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "relevance");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("part", "id");

  const res = await fetch(url.toString());
  const data = await res.json();
  return (data.items ?? []).map(
    (item: { id: { videoId: string } }) => item.id.videoId,
  );
}

// ─────────────────────────────────────────────
// FETCH VIDEO DETAILS + STATS
// ─────────────────────────────────────────────

async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<YouTubeVideo[]> {
  if (videoIds.length === 0) return [];

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("part", "snippet,statistics");

  const res = await fetch(url.toString());
  const data = await res.json();

  return (data.items ?? []).map(
    (item: {
      id: string;
      snippet: { title: string; thumbnails: { medium: { url: string } } };
      statistics: { viewCount?: string };
    }) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      viewCount: parseInt(item.statistics.viewCount ?? "0", 10),
      thumbnail: item.snippet.thumbnails?.medium?.url ?? "",
    }),
  );
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

export async function getYouTubeVideoLive(
  topic: string,
  persona: PersonaId,
  apiKey: string,
): Promise<YouTubeResult | YouTubeNotFound> {
  try {
    const handles = PERSONA_CHANNEL_HANDLES[persona];

    // Step 1 — resolve channel handles to IDs
    const channelIds = await resolveChannelIds(handles, apiKey);

    if (channelIds.length === 0) {
      return { found: false, message: `Could not resolve YouTube channels for ${persona}.` };
    }

    // Step 2 — search across all channels, collect video IDs
    const allVideoIds: string[] = [];
    for (const channelId of channelIds) {
      const ids = await searchInChannel(topic, channelId, apiKey, 5);
      allVideoIds.push(...ids);
    }

    if (allVideoIds.length === 0) {
      return { found: false, message: `No videos found for "${topic}" on these channels yet — video coming soon!` };
    }

    // Step 3 — fetch details + stats, deduplicate
    const uniqueIds = [...new Set(allVideoIds)];
    const videos = await fetchVideoDetails(uniqueIds, apiKey);

    if (videos.length === 0) {
      return { found: false, message: `No videos found for "${topic}" — video coming soon!` };
    }

    // Step 4 — sort by view count (most popular first)
    const sorted = videos.sort((a, b) => b.viewCount - a.viewCount);

    return { found: true, top: sorted[0], all: sorted };
  } catch (err) {
    console.error("[youtube] getYouTubeVideoLive error:", err);
    return { found: false, message: `YouTube search failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}
