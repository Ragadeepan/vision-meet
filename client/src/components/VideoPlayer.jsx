import { useEffect, useRef } from "react";

const VideoPlayer = ({ stream, name, muted = false, isLocal = false, isVideoOff = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-soft">
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
          <div className="grid h-20 w-20 place-items-center rounded-full bg-blue-600 text-2xl font-black text-white">
            {name?.slice(0, 1)?.toUpperCase() || "U"}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">
        {name || "Guest"} {isLocal ? "(You)" : ""}
      </div>
    </div>
  );
};

export default VideoPlayer;
