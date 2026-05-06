const ParticipantList = ({ participants, currentUser, isHost, onMuteAll, onRemoveUser }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-slate-950 dark:text-white">Participants</h2>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {participants.length}
      </span>
    </div>

    {isHost && (
      <button type="button" onClick={onMuteAll} className="mb-4 w-full rounded-2xl bg-amber-500 px-4 py-2 font-semibold text-white">
        Mute all
      </button>
    )}

    <div className="space-y-3">
      {participants.map((participant) => {
        const user = participant.user || participant;
        const isMe = user?._id === currentUser?._id;
        return (
          <div key={participant.socketId || user?._id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-100 p-3 dark:bg-slate-900">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {user?.name || "Guest"} {isMe ? "(You)" : ""}
              </p>
              <p className="text-xs text-slate-500">
                {participant.role || "participant"} {participant.raisedHand ? " - hand raised" : ""}
              </p>
              <p className="text-xs text-slate-500">
                {participant.isMuted ? "Muted" : "Mic on"} - {participant.isVideoOff ? "Camera off" : "Camera on"}
              </p>
            </div>
            {isHost && !isMe && participant.socketId && (
              <button
                type="button"
                onClick={() => onRemoveUser(participant.socketId)}
                className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white"
              >
                Remove
              </button>
            )}
          </div>
        );
      })}
    </div>
  </section>
);

export default ParticipantList;
