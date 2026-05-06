import { useEffect, useRef } from "react";

const VideoPlayer = ({
  stream,
  name,
  muted = false,
  isMuted = false,
  isLocal = false,
  isVideoOff = false,
  badge,
  subtitle,
  raisedHand = false,
  isHighlighted = false,
  onSelect
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative min-h-[220px] overflow-hidden rounded-[1.75rem] border text-left shadow-soft transition focus:outline-none ${
        isHighlighted
          ? "border-cyan-400 ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-950"
          : "border-slate-800/80 hover:border-cyan-400/60"
      } bg-slate-950`}
    >
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="h-full min-h-[220px] w-full object-cover"
        />
      ) : (
        <div className="grid h-full min-h-[220px] place-items-center bg-slate-900">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-cyan-500 text-2xl font-black text-slate-950">
            {name?.slice(0, 1)?.toUpperCase() || "U"}
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
        {badge && (
          <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
            {badge}
          </span>
        )}
        {raisedHand && (
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-950">
            Hand Raised
          </span>
        )}
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-white">
            {name || "Guest"} {isLocal ? "(You)" : ""}
          </p>
          {subtitle && <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.18em] text-slate-300">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isMuted ? "bg-rose-500 text-white" : "bg-emerald-400 text-slate-950"}`}>
            {isMuted ? "Mic Off" : "Mic On"}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isVideoOff ? "bg-slate-700 text-white" : "bg-cyan-400 text-slate-950"}`}>
            {isVideoOff ? "Camera Off" : "Camera On"}
          </span>
        </div>
      </div>
    </button>
  );
};

export default VideoPlayer;
