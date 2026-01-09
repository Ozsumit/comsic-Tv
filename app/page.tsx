"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Hls from "hls.js";
import {
  Play,
  Search,
  Disc,
  Tv,
  Trophy,
  Globe,
  Zap,
  RotateCcw,
  Moon,
  Sun,
  SignalHigh,
  SignalLow,
  XCircle,
  ChevronDown,
} from "lucide-react";

// --- TYPES ---
interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  isCustom?: boolean;
  score: number;
}

// --- CONFIG ---
const FAST_DOMAINS = [
  "samsungtv",
  "pluto.tv",
  "rakuten",
  "plex",
  "tubi",
  "roku",
  "amagi",
];
const SPORTS_KEYWORDS = [
  "sport",
  "espn",
  "football",
  "soccer",
  "racing",
  "nba",
  "nfl",
  "tennis",
  "ufc",
  "wwe",
  "league",
  "fox",
  "sky",
  "bein",
  "arena",
];

const CUSTOM_CHANNELS: Partial<Channel>[] = [
  {
    name: "Red Bull TV",
    url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/RedBullTVLogo.svg/1200px-RedBullTVLogo.svg.png",
    group: "Extreme Sports",
    isCustom: true,
  },
];

export default function ComsicTV() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // -- State --
  // Defaulting to dark, but with high contrast colors now
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [workingIds, setWorkingIds] = useState<string[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<
    "idle" | "loading" | "playing" | "error"
  >("idle");

  // -- UI State --
  const [viewMode, setViewMode] = useState<"sports" | "all">("sports");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [appLoading, setAppLoading] = useState(true);

  // -- Theme Handler --
  useEffect(() => {
    // This is just for body background handling if needed
    document.body.style.backgroundColor =
      theme === "dark" ? "#09090b" : "#f4f4f5";
  }, [theme]);

  // -- Data Fetching --
  useEffect(() => {
    const saved = localStorage.getItem("swiss_working_channels");
    if (saved) setWorkingIds(JSON.parse(saved));

    async function loadPlaylist() {
      try {
        const res = await fetch("https://iptv-org.github.io/iptv/index.m3u");
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
            if (FAST_DOMAINS.some((d) => lowerUrl.includes(d))) score += 50;
            if (line.startsWith("https")) score += 10;
            parsed.push({
              id: `${name}-${i}`,
              name,
              logo,
              group,
              url: line,
              score,
            });
          }
        }
        const customs: Channel[] = CUSTOM_CHANNELS.map((c, i) => ({
          id: `custom-${i}`,
          name: c.name!,
          url: c.url!,
          logo: c.logo || "",
          group: c.group || "Custom",
          isCustom: true,
          score: 1000,
        }));
        setAllChannels([...customs, ...parsed]);
      } catch (err) {
        console.error(err);
      } finally {
        setAppLoading(false);
      }
    }
    loadPlaylist();
  }, []);

  // -- Player Logic --
  useEffect(() => {
    if (!currentChannel || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls;
    let loadTimeout: NodeJS.Timeout;

    setPlayerStatus("loading");

    loadTimeout = setTimeout(() => {
      if (video.paused && video.readyState < 3) setPlayerStatus("error");
    }, 10000);

    const handleSuccess = () => {
      setPlayerStatus("playing");
      clearTimeout(loadTimeout);
      if (!workingIds.includes(currentChannel.id)) {
        const newIds = [currentChannel.id, ...workingIds].slice(0, 50);
        setWorkingIds(newIds);
        localStorage.setItem("swiss_working_channels", JSON.stringify(newIds));
      }
    };

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(currentChannel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.FRAG_LOADED, handleSuccess);
      hls.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) {
          setPlayerStatus("error");
          clearTimeout(loadTimeout);
        }
      });
    } else {
      video.src = currentChannel.url;
      video.load();
      video.onplaying = handleSuccess;
      video.onerror = () => setPlayerStatus("error");
      video.play().catch(() => {});
    }

    return () => {
      if (hls) hls.destroy();
      clearTimeout(loadTimeout);
    };
  }, [currentChannel]);

  // -- Sorting --
  const displayList = useMemo(() => {
    let list = allChannels;
    if (viewMode === "sports") {
      list = list.filter((c) => {
        if (c.isCustom) return true;
        const txt = (c.name + c.group).toLowerCase();
        return SPORTS_KEYWORDS.some((k) => txt.includes(k));
      });
    }
    if (search)
      list = list.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      );

    return list.sort((a, b) => {
      let scoreA = a.score;
      let scoreB = b.score;
      if (workingIds.includes(a.id)) scoreA += 100;
      if (workingIds.includes(b.id)) scoreB += 100;
      return scoreB - scoreA;
    });
  }, [allChannels, viewMode, search, workingIds]);

  // -- Helpers --
  const getSignalIcon = (channel: Channel) => {
    const isVerified = workingIds.includes(channel.id) || channel.score >= 50;
    if (channel.isCustom)
      return <Zap size={16} className="text-yellow-500 fill-yellow-500" />;
    if (isVerified)
      return <SignalHigh size={16} className="text-emerald-500" />;
    return <SignalLow size={16} className="text-zinc-500" />;
  };

  // --- STYLES CONFIG ---
  const isDark = theme === "dark";

  // Backgrounds
  const bgMain = isDark ? "bg-[#09090b]" : "bg-[#f4f4f5]";
  const bgCard = isDark ? "bg-[#18181b]" : "bg-white";
  const bgInput = isDark ? "bg-[#27272a]" : "bg-zinc-100";
  const bgHeader = isDark
    ? "bg-[#09090b]/80 border-zinc-800"
    : "bg-white/80 border-zinc-200";

  // Borders
  const borderBase = isDark ? "border-zinc-800" : "border-zinc-200";
  const borderHover = isDark ? "border-zinc-600" : "border-zinc-300";

  // Text
  const textPrimary = isDark ? "text-white" : "text-zinc-900";
  const textSecondary = isDark ? "text-zinc-400" : "text-zinc-500";
  const textMuted = isDark ? "text-zinc-600" : "text-zinc-400";

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-200 ${bgMain} ${textPrimary}`}
    >
      {/* HEADER */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-xl border-b py-4 px-4 lg:px-8 ${bgHeader}`}
      >
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isDark ? "bg-black invert-100" : "bg-black text-white"
              }`}
            >
              <img src="/logo.svg" alt="Comsic TV Logo" className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">
                Comsic TV
              </h1>
              <p
                className={`text-[10px] font-bold uppercase tracking-widest pt-1 ${textSecondary}`}
              >
                IPTV Player
              </p>
            </div>
          </div>

          <div
            className={`flex p-1 rounded-full border ${
              isDark
                ? "bg-[#18181b] border-zinc-800"
                : "bg-white border-zinc-200 shadow-sm"
            }`}
          >
            <button
              onClick={() => setViewMode("sports")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "sports"
                  ? isDark
                    ? "bg-zinc-700 text-white"
                    : "bg-black text-white"
                  : `${textSecondary} hover:text-current`
              }`}
            >
              <Trophy size={14} /> Sports
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "all"
                  ? isDark
                    ? "bg-zinc-700 text-white"
                    : "bg-black text-white"
                  : `${textSecondary} hover:text-current`
              }`}
            >
              <Globe size={14} /> All
            </button>
          </div>

          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`p-2.5 rounded-full border transition-all ${
              isDark
                ? "border-zinc-800 bg-[#18181b] hover:bg-zinc-800 text-yellow-400"
                : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600"
            }`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-8">
        {/* --- LEFT: PLAYER --- */}
        <div className="lg:col-span-8 space-y-4">
          <div className="sticky top-24 z-10">
            {/* Video Box */}
            <div
              className={`relative aspect-video rounded-3xl overflow-hidden shadow-2xl transition-all ${
                isDark
                  ? "bg-black ring-1 ring-zinc-800"
                  : "bg-black ring-4 ring-white"
              }`}
            >
              {currentChannel ? (
                <>
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />

                  {playerStatus === "loading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                      <div className="w-12 h-12 border-4 border-zinc-700 border-t-white rounded-full animate-spin mb-4" />
                      <p className="text-sm font-bold text-white tracking-wide">
                        Connecting...
                      </p>
                    </div>
                  )}

                  {playerStatus === "error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-20 px-4 text-center">
                      <div className="p-3 bg-red-500/10 text-red-500 rounded-full mb-3">
                        <XCircle size={32} />
                      </div>
                      <h3 className="text-white font-bold mb-1">Signal Lost</h3>
                      <button
                        onClick={() => setPlayerStatus("loading")}
                        className="mt-4 flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full text-xs font-bold hover:scale-105 transition"
                      >
                        <RotateCcw size={14} /> Retry
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                      isDark
                        ? "bg-zinc-900 text-zinc-700"
                        : "bg-zinc-100 text-zinc-300"
                    }`}
                  >
                    <Play size={32} fill="currentColor" />
                  </div>
                  <p className={`font-medium ${textSecondary}`}>
                    Select a channel to start
                  </p>
                </div>
              )}
            </div>

            {/* Meta Card */}
            <div
              className={`mt-4 p-5 rounded-3xl border flex items-center justify-between ${bgCard} ${borderBase}`}
            >
              <div>
                <h2
                  className={`font-bold text-lg leading-tight truncate max-w-md ${textPrimary}`}
                >
                  {currentChannel?.name || "No Channel Selected"}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      isDark
                        ? "bg-zinc-800 text-zinc-400"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        playerStatus === "playing"
                          ? "bg-emerald-500"
                          : "bg-zinc-500"
                      }`}
                    />
                    {playerStatus === "playing" ? "Live" : "Offline"}
                  </div>
                  {currentChannel?.group && (
                    <div
                      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isDark
                          ? "bg-zinc-800 text-zinc-400"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {currentChannel.group}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT: LIST --- */}
        <div className="lg:col-span-4 flex flex-col h-[calc(100vh-140px)] sticky top-24">
          {/* Search Box */}
          <div
            className={`p-2 rounded-2xl border mb-4 flex items-center gap-3 ${bgCard} ${borderBase}`}
          >
            <div
              className={`p-2 rounded-xl ${
                isDark
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-zinc-100 text-zinc-400"
              }`}
            >
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Find channel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent w-full outline-none text-sm font-semibold placeholder:${textMuted} ${textPrimary}`}
            />
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-20">
            {appLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Disc className={`animate-spin mb-2 ${textSecondary}`} />
                <span
                  className={`text-xs font-bold uppercase tracking-widest ${textSecondary}`}
                >
                  Loading Library...
                </span>
              </div>
            ) : (
              <>
                {displayList.slice(0, limit).map((channel) => {
                  const isActive = currentChannel?.id === channel.id;

                  return (
                    <button
                      key={channel.id}
                      onClick={() => setCurrentChannel(channel)}
                      className={`
                        w-full group relative flex items-center gap-4 p-3 rounded-2xl text-left transition-all duration-200 border
                        ${
                          isActive
                            ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/20"
                            : `${bgCard} ${borderBase} hover:${borderHover} hover:scale-[1.01]`
                        }
                      `}
                    >
                      {/* Logo Area */}
                      <div
                        className={`
                        w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border
                        ${
                          isActive
                            ? "bg-blue-500/20 border-blue-400/30"
                            : `${
                                isDark
                                  ? "bg-zinc-900 border-zinc-800"
                                  : "bg-zinc-50 border-zinc-200"
                              }`
                        }
                      `}
                      >
                        {channel.logo ? (
                          <img
                            src={channel.logo}
                            alt=""
                            className="w-full h-full object-contain p-1"
                            onError={(e) =>
                              (e.currentTarget.style.display = "none")
                            }
                          />
                        ) : (
                          <span
                            className={`text-xs font-bold ${
                              isActive ? "text-white/70" : textMuted
                            }`}
                          >
                            TV
                          </span>
                        )}
                      </div>

                      {/* Info Area */}
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`text-sm font-bold truncate ${
                            isActive ? "text-white" : textPrimary
                          }`}
                        >
                          {channel.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p
                            className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                              isActive ? "text-blue-100" : textSecondary
                            }`}
                          >
                            {channel.group}
                          </p>
                        </div>
                      </div>

                      {/* Right Icon (Signal) */}
                      <div className={`${isActive ? "text-white" : ""}`}>
                        {getSignalIcon(channel)}
                      </div>
                    </button>
                  );
                })}

                <button
                  onClick={() => setLimit((l) => l + 50)}
                  className={`w-full py-4 mt-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    isDark
                      ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
                      : "bg-white hover:bg-zinc-50 text-zinc-500 border border-zinc-200"
                  }`}
                >
                  <ChevronDown size={14} /> Load More
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
