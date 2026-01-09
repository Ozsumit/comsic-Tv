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
  Wifi,
  Radio,
  AlertTriangle,
  ChevronDown,
  RefreshCcw,
  Plus,
  Pin,
} from "lucide-react";
import { Channel } from "@/lib/playlists"; // Import the type

// Re-define keywords strictly for filtering logic in UI
const SPORTS_KEYWORDS = [
  "sport",
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
  "arena",
  "fight",
  "golf",
];

interface ClientProps {
  initialChannels: Channel[];
}

export default function CosmicTVClient({ initialChannels }: ClientProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // -- State --
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Initialize with the data passed from the server
  const [allChannels, setAllChannels] = useState<Channel[]>(initialChannels);

  const [workingIds, setWorkingIds] = useState<string[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<
    "idle" | "loading" | "playing" | "error" | "proxying" | "dead"
  >("idle");

  const [viewMode, setViewMode] = useState<"sports" | "all">("sports");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  // -- Theme Handler --
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.backgroundColor =
        theme === "dark" ? "#09090b" : "#f4f4f5";
    }
  }, [theme]);

  // -- LOAD HISTORY --
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("swiss_working_channels");
      if (saved) setWorkingIds(JSON.parse(saved));
    }
  }, []);

  // -- PLAYER LOGIC (Kept same as your code) --
  useEffect(() => {
    if (!currentChannel || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | null = null;
    let loadTimeout: NodeJS.Timeout;

    setPlayerStatus("loading");

    loadTimeout = setTimeout(() => {
      if (video.paused && video.readyState < 3) setPlayerStatus("error");
    }, 15000);

    const handleSuccess = () => {
      setPlayerStatus("playing");
      clearTimeout(loadTimeout);
      if (!workingIds.includes(currentChannel.id)) {
        const newIds = [currentChannel.id, ...workingIds].slice(0, 50);
        setWorkingIds(newIds);
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "swiss_working_channels",
            JSON.stringify(newIds)
          );
        }
      }
    };

    const initStream = (urlToPlay: string, isProxyAttempt = false) => {
      if (Hls.isSupported()) {
        if (hls) hls.destroy();
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (
                data.response?.code === 0 ||
                data.response?.code === 404 ||
                data.response?.code === 530
              ) {
                if (isProxyAttempt) {
                  setPlayerStatus("dead");
                  return;
                }
              }
              if (!isProxyAttempt) {
                setPlayerStatus("proxying");
                hls?.destroy();
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(
                  currentChannel.url
                )}`;
                initStream(proxyUrl, true);
              } else {
                setPlayerStatus("dead");
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls?.recoverMediaError();
            } else {
              hls?.destroy();
              setPlayerStatus("error");
            }
          }
        });

        hls.loadSource(urlToPlay);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => console.log("Autoplay prevented"));
        });
        hls.on(Hls.Events.FRAG_LOADED, handleSuccess);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = urlToPlay;
        video.load();
        video.onplaying = handleSuccess;
        video.onerror = () => setPlayerStatus("error");
        video.play().catch(() => {});
      }
    };

    initStream(currentChannel.url, false);

    return () => {
      if (hls) hls.destroy();
      clearTimeout(loadTimeout);
    };
  }, [currentChannel, workingIds]);

  // -- Direct URL Paste --
  const handleUrlPaste = () => {
    if (!search.startsWith("http")) return;
    const newChannel: Channel = {
      id: `pasted-${Date.now()}`,
      name: "Direct Stream",
      url: search.trim(),
      group: "Input",
      logo: "",
      score: 10000,
      isCustom: true,
      isPinned: true,
    };
    setAllChannels([newChannel, ...allChannels]);
    setCurrentChannel(newChannel);
    setSearch("");
  };

  // -- SORTING & FILTERING --
  const displayList = useMemo(() => {
    let list = allChannels;
    if (viewMode === "sports") {
      list = list.filter((c) => {
        if (c.isCustom || c.isPinned) return true;
        const txt = (c.name + c.group).toLowerCase();
        return SPORTS_KEYWORDS.some((k) => txt.includes(k));
      });
    }
    if (search && !search.startsWith("http"))
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

  // -- HELPERS --
  const isUrlInput = search.startsWith("http");
  const isDark = theme === "dark";
  const bgMain = isDark ? "bg-[#09090b]" : "bg-[#f4f4f5]";
  const bgCard = isDark ? "bg-[#18181b]" : "bg-white";
  const bgHeader = isDark
    ? "bg-[#09090b]/80 border-zinc-800"
    : "bg-white/80 border-zinc-200";
  const textPrimary = isDark ? "text-white" : "text-zinc-900";
  const textSecondary = isDark ? "text-zinc-400" : "text-zinc-500";

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
              <Tv size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">
                Comsic TV
              </h1>
              <p
                className={`text-[10px] font-bold uppercase tracking-widest pt-1 ${textSecondary}`}
              >
                Subset of{" "}
                <a
                  href="https://cmoon.sumit.info.np"
                  target="_blank"
                  rel="noreferrer"
                >
                  Crescent Moon
                </a>
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

      {/* BODY */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="sticky top-24 z-10">
            {/* PLAYER CONTAINER */}
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
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  {playerStatus === "loading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                      <div className="w-12 h-12 border-4 border-zinc-700 border-t-white rounded-full animate-spin mb-4" />
                      <p className="text-sm font-bold text-white">
                        Connecting...
                      </p>
                    </div>
                  )}
                  {playerStatus === "proxying" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                      <RefreshCcw
                        className="animate-spin mb-4 text-blue-500"
                        size={48}
                      />
                      <p className="text-sm font-bold text-white">
                        Bypassing Geo-Block...
                      </p>
                    </div>
                  )}
                  {(playerStatus === "dead" || playerStatus === "error") && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-20 px-4 text-center">
                      <div className="p-3 bg-red-500/10 text-red-500 rounded-full mb-3">
                        <AlertTriangle size={32} />
                      </div>
                      <h3 className="text-white font-bold mb-1">
                        {playerStatus === "dead"
                          ? "Stream Expired"
                          : "Signal Lost"}
                      </h3>
                      <button
                        onClick={() => setPlayerStatus("loading")}
                        className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full text-xs font-bold hover:scale-105 transition mt-4"
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

            {/* CURRENT INFO CARD */}
            <div
              className={`mt-4 p-5 rounded-3xl border flex items-center justify-between ${bgCard} ${
                isDark ? "border-zinc-800" : "border-zinc-200"
              }`}
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
                          : playerStatus === "proxying"
                          ? "bg-blue-500 animate-pulse"
                          : "bg-zinc-500"
                      }`}
                    />
                    {playerStatus === "playing"
                      ? "Live"
                      : playerStatus === "proxying"
                      ? "Unblocking..."
                      : "Offline"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 flex flex-col h-[calc(100vh-140px)] sticky top-24">
          <div
            className={`p-2 rounded-2xl border mb-4 flex items-center gap-3 ${bgCard} ${
              isDark ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <div
              className={`p-2 rounded-xl ${
                isDark
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {isUrlInput ? (
                <Plus size={18} className="text-emerald-500" />
              ) : (
                <Search size={18} />
              )}
            </div>
            <input
              type="text"
              placeholder="Search or Paste .m3u8..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent w-full outline-none text-sm font-semibold placeholder:${textSecondary} ${textPrimary}`}
            />
            {isUrlInput && (
              <button
                onClick={handleUrlPaste}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
              >
                Play
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-20">
            {displayList.slice(0, limit).map((channel) => {
              const isActive = currentChannel?.id === channel.id;
              const isVerified =
                workingIds.includes(channel.id) || channel.score >= 50;
              return (
                <button
                  key={channel.id}
                  onClick={() => setCurrentChannel(channel)}
                  className={`w-full group relative flex items-center gap-4 p-3 rounded-2xl text-left transition-all duration-200 border ${
                    isActive
                      ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/20"
                      : `${bgCard} ${
                          isDark
                            ? "border-zinc-800 hover:border-zinc-600"
                            : "border-zinc-200 hover:border-zinc-300"
                        } hover:scale-[1.01]`
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border ${
                      isActive
                        ? "bg-blue-500/20 border-blue-400/30"
                        : `${
                            isDark
                              ? "bg-zinc-900 border-zinc-800"
                              : "bg-zinc-50 border-zinc-200"
                          }`
                    }`}
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt=""
                        className="w-full h-full object-contain p-1"
                        loading="lazy"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    ) : (
                      <span
                        className={`text-xs font-bold ${
                          isActive ? "text-white/70" : textSecondary
                        }`}
                      >
                        TV
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-bold truncate ${
                          isActive ? "text-white" : textPrimary
                        }`}
                      >
                        {channel.name}
                      </h3>
                      {channel.isPinned && (
                        <Pin
                          size={12}
                          className={`fill-current ${
                            isActive ? "text-white" : "text-blue-500"
                          }`}
                        />
                      )}
                    </div>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wider truncate mt-0.5 ${
                        isActive ? "text-blue-100" : textSecondary
                      }`}
                    >
                      {channel.group}
                    </p>
                  </div>
                  <div className={`${isActive ? "text-white" : ""}`}>
                    {channel.isCustom ? (
                      <Zap
                        size={16}
                        className="text-yellow-500 fill-yellow-500"
                      />
                    ) : isVerified ? (
                      <Wifi size={16} className="text-emerald-500" />
                    ) : (
                      <Radio size={16} className="text-zinc-500" />
                    )}
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
          </div>
        </div>
      </div>
    </div>
  );
}
