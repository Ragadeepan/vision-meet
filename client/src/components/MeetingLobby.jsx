import VideoPlayer from "./VideoPlayer";

const mediaModeCopy = {
  "camera-and-mic": "Camera and microphone ready",
  "mic-only": "Microphone ready, camera unavailable",
  "camera-only": "Camera ready, microphone unavailable",
  "chat-only": "Join with chat only for now"
};

const MeetingLobby = ({
  room,
  roomId,
  user,
  localStream,
  status,
  mediaMode,
  mediaError,
  isPreparingPreview,
  isJoining,
  isMuted,
  isVideoOff,
  audioDevices,
  videoDevices,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onSelectAudioDevice,
  onSelectVideoDevice,
  onToggleMute,
  onToggleVideo,
  onRetryPreview,
  onJoinMeeting
}) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,_#f5fbff_0%,_#eaf2ff_45%,_#f8fafc_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#020617_52%,_#0f172a_100%)] dark:text-white">
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-slate-900/72">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300">Pre-Join Studio</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">{room?.name || "Meeting Room"}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Meeting ID: {room?.meetingId || roomId}</p>
            </div>
            <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300 dark:bg-slate-800">
              {mediaModeCopy[mediaMode] || "Preparing your setup"}
            </div>
          </div>

          <VideoPlayer
            stream={localStream}
            name={user?.name || "You"}
            muted
            isMuted={isMuted}
            isLocal
            isVideoOff={isVideoOff}
            badge="Preview"
            subtitle={status}
            isHighlighted
          />

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={onToggleMute} type="button" className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${isMuted ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-slate-950 text-white hover:bg-slate-800 dark:bg-slate-700"}`}>
              {isMuted ? "Turn Mic On" : "Mute Mic"}
            </button>
            <button onClick={onToggleVideo} type="button" className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${isVideoOff ? "bg-amber-400 text-slate-950 hover:bg-amber-300" : "bg-slate-950 text-white hover:bg-slate-800 dark:bg-slate-700"}`}>
              {isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            </button>
            <button onClick={onRetryPreview} type="button" className="secondary-button">
              {isPreparingPreview ? "Refreshing devices..." : "Retry Devices"}
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/60 bg-white/82 p-6 shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-slate-900/78">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-[1.5rem] bg-slate-950 p-5 text-white dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Audio Input</p>
              <select
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none"
                value={selectedAudioDeviceId}
                onChange={(event) => onSelectAudioDevice(event.target.value)}
              >
                <option value="">Default microphone</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId} className="text-slate-950">
                    {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </article>

            <article className="rounded-[1.5rem] bg-slate-950 p-5 text-white dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Video Input</p>
              <select
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none"
                value={selectedVideoDeviceId}
                onChange={(event) => onSelectVideoDevice(event.target.value)}
              >
                <option value="">Default camera</option>
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId} className="text-slate-950">
                    {device.label || `Camera ${device.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </article>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Connection Summary</p>
            <h2 className="mt-3 text-2xl font-black">{mediaModeCopy[mediaMode] || "Checking devices..."}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {mediaError || "Preview your setup, choose the right devices, and join when everything looks good. If the camera is blocked, you can retry without leaving the room flow."}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Low friction join", value: "Fast lobby preview" },
              { label: "Recovery mode", value: "Retry media without refresh" },
              { label: "Call upgrade", value: "Advanced layout in-room" }
            ].map((item) => (
              <div key={item.label} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className="mt-3 text-sm font-bold text-slate-950 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={onJoinMeeting} type="button" disabled={isJoining} className="primary-button flex-1 text-center">
              {isJoining ? "Joining meeting..." : "Join Meeting"}
            </button>
            <button onClick={onRetryPreview} type="button" className="secondary-button flex-1 text-center">
              Refresh Preview
            </button>
          </div>
        </section>
      </div>
    </main>
  </div>
);

export default MeetingLobby;
