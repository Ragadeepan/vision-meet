import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import Navbar from "../components/Navbar";
import ParticipantList from "../components/ParticipantList";
import VideoPlayer from "../components/VideoPlayer";
import { connectSocket, disconnectSocket } from "../services/socket";
import {
  acceptAnswer,
  addIceCandidate,
  createAnswer,
  createOffer,
  createPeerConnection,
  getDisplayMedia,
  getLocalMedia,
  mediaConstraints,
  replaceVideoTrack,
  stopStream
} from "../services/webrtc";
import { useAuthStore } from "../store/authStore";
import { useMeetingStore } from "../store/meetingStore";

const recorderMimeTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

const getSupportedRecorderType = () => recorderMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const {
    currentRoom,
    currentMeeting,
    messages,
    fetchRoom,
    joinRoom,
    startMeeting,
    endMeeting,
    appendMessage,
    uploadRecording,
    resetCurrentMeeting
  } = useMeetingStore();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState("Preparing your camera and microphone...");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [raisedHand, setRaisedHand] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [joinNonce, setJoinNonce] = useState(0);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const participantsRef = useRef([]);
  const peerConnectionsRef = useRef({});
  const pendingIceRef = useRef({});
  const recordingChunksRef = useRef([]);
  const recorderRef = useRef(null);
  const recordingCleanupRef = useRef(null);
  const recordingUploadedRef = useRef(false);
  const meetingRef = useRef(null);
  const restoringCameraRef = useRef(false);
  const localVideoOffRef = useRef(false);

  const isHost = useMemo(() => currentRoom?.hostId?._id === user?._id, [currentRoom, user]);

  useEffect(() => {
    meetingRef.current = currentMeeting;
  }, [currentMeeting]);

  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    localVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  const sendSignal = useCallback(
    (to, signal) => {
      socketRef.current?.emit("webrtc-signal", { roomId, to, signal });
    },
    [roomId]
  );

  const removePeer = useCallback((socketId) => {
    peerConnectionsRef.current[socketId]?.close();
    delete peerConnectionsRef.current[socketId];
    delete pendingIceRef.current[socketId];
    setRemoteStreams((streams) => {
      const nextStreams = { ...streams };
      delete nextStreams[socketId];
      return nextStreams;
    });
  }, []);

  const flushPendingIce = useCallback(async (socketId) => {
    const peerConnection = peerConnectionsRef.current[socketId];
    const pendingCandidates = pendingIceRef.current[socketId] || [];
    if (!peerConnection?.remoteDescription || pendingCandidates.length === 0) {
      return;
    }

    await Promise.all(pendingCandidates.map((candidate) => addIceCandidate(peerConnection, candidate).catch(() => {})));
    pendingIceRef.current[socketId] = [];
  }, []);

  const ensurePeerConnection = useCallback(
    (socketId) => {
      if (peerConnectionsRef.current[socketId]) {
        return peerConnectionsRef.current[socketId];
      }

      const peerConnection = createPeerConnection({
        localStream: localStreamRef.current,
        remoteSocketId: socketId,
        onIceCandidate: (targetSocketId, candidate) => sendSignal(targetSocketId, { candidate }),
        onRemoteStream: (targetSocketId, stream) => {
          setRemoteStreams((streams) => ({ ...streams, [targetSocketId]: stream }));
        },
        onConnectionStateChange: (targetSocketId, connectionState) => {
          if (["failed", "closed", "disconnected"].includes(connectionState)) {
            removePeer(targetSocketId);
          }
        }
      });

      peerConnectionsRef.current[socketId] = peerConnection;
      return peerConnection;
    },
    [removePeer, sendSignal]
  );

  const startRecording = useCallback(
    (stream) => {
      if (!stream || recorderRef.current || typeof MediaRecorder === "undefined") {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context || !canvas.captureStream) {
        return;
      }
      const canvasStream = canvas.captureStream(30);
      const videoElements = new Map();
      const connectedAudioTracks = new Set();
      const audioSources = [];
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = AudioContextClass ? new AudioContextClass() : null;
      const audioDestination = audioContext?.createMediaStreamDestination();
      audioContext?.resume().catch(() => {});
      let animationFrameId;

      const getVideoElement = (key, sourceStream) => {
        let video = videoElements.get(key);
        if (!video) {
          video = document.createElement("video");
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          video.srcObject = sourceStream;
          video.play().catch(() => {});
          videoElements.set(key, video);
        } else if (video.srcObject !== sourceStream) {
          video.srcObject = sourceStream;
          video.play().catch(() => {});
        }
        return video;
      };

      const connectAudio = (key, sourceStream) => {
        if (!audioContext || !audioDestination) {
          return;
        }

        sourceStream.getAudioTracks().forEach((track) => {
          const trackKey = `${key}-${track.id}`;
          if (connectedAudioTracks.has(trackKey)) {
            return;
          }

          const audioTrackStream = new MediaStream([track]);
          const source = audioContext.createMediaStreamSource(audioTrackStream);
          source.connect(audioDestination);
          audioSources.push(source);
          connectedAudioTracks.add(trackKey);
        });
      };

      const drawTile = ({ key, name, sourceStream, isVideoOff }, index, total) => {
        const columns = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / columns);
        const width = canvas.width / columns;
        const height = canvas.height / rows;
        const x = (index % columns) * width;
        const y = Math.floor(index / columns) * height;
        const video = getVideoElement(key, sourceStream);

        context.fillStyle = "#020617";
        context.fillRect(x, y, width, height);

        if (!isVideoOff && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
          const scaledWidth = video.videoWidth * scale;
          const scaledHeight = video.videoHeight * scale;
          context.drawImage(video, x + (width - scaledWidth) / 2, y + (height - scaledHeight) / 2, scaledWidth, scaledHeight);
        } else {
          context.fillStyle = "#2563eb";
          context.beginPath();
          context.arc(x + width / 2, y + height / 2, Math.min(width, height) / 7, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#ffffff";
          context.font = "bold 44px sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(name?.slice(0, 1)?.toUpperCase() || "U", x + width / 2, y + height / 2);
        }

        context.fillStyle = "rgba(0, 0, 0, 0.6)";
        context.fillRect(x + 18, y + height - 54, Math.min(width - 36, 320), 36);
        context.fillStyle = "#ffffff";
        context.font = "bold 20px sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(name || "Participant", x + 32, y + height - 36);
      };

      const drawFrame = () => {
        context.fillStyle = "#020617";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const participantMap = new Map(participantsRef.current.map((participant) => [participant.socketId, participant]));
        const entries = [
          { key: "local", name: user?.name || "You", sourceStream: stream, isVideoOff: localVideoOffRef.current },
          ...Object.entries(remoteStreamsRef.current).map(([socketId, sourceStream]) => {
            const participant = participantMap.get(socketId);
            return {
              key: socketId,
              name: participant?.user?.name || "Participant",
              sourceStream,
              isVideoOff: participant?.isVideoOff
            };
          })
        ].filter((entry) => entry.sourceStream);

        entries.forEach((entry) => connectAudio(entry.key, entry.sourceStream));

        const activeKeys = new Set(entries.map((entry) => entry.key));
        videoElements.forEach((_video, key) => {
          if (!activeKeys.has(key)) {
            videoElements.delete(key);
          }
        });

        entries.forEach((entry, index) => drawTile(entry, index, entries.length || 1));
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      drawFrame();

      const recordingStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioDestination?.stream.getAudioTracks() || [])
      ]);
      const mimeType = getSupportedRecorderType();
      const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);

      recordingCleanupRef.current = () => {
        cancelAnimationFrame(animationFrameId);
        canvasStream.getTracks().forEach((track) => track.stop());
        recordingStream.getTracks().forEach((track) => track.stop());
        audioSources.forEach((source) => source.disconnect());
        audioContext?.close().catch(() => {});
        videoElements.clear();
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        recordingCleanupRef.current?.();
        recordingCleanupRef.current = null;

        if (recordingUploadedRef.current || recordingChunksRef.current.length === 0 || !meetingRef.current?._id) {
          return;
        }

        recordingUploadedRef.current = true;
        const blob = new Blob(recordingChunksRef.current, { type: mimeType || "video/webm" });
        await uploadRecording(meetingRef.current._id, blob).catch(() => {
          recordingUploadedRef.current = false;
        });
      };

      recorder.start(5000);
      recorderRef.current = recorder;
    },
    [uploadRecording]
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }

    recordingCleanupRef.current?.();
    recordingCleanupRef.current = null;
  }, []);

  const restoreCamera = useCallback(async () => {
    if (!localStreamRef.current || restoringCameraRef.current) {
      return;
    }

    restoringCameraRef.current = true;
    try {
      const cameraStream = await getLocalMedia({ video: mediaConstraints.video, audio: false });
      const [cameraTrack] = cameraStream.getVideoTracks();
      await replaceVideoTrack(peerConnectionsRef.current, localStreamRef.current, cameraTrack);
      setIsSharingScreen(false);
    } finally {
      restoringCameraRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootRoom = async () => {
      try {
        setAccessError("");
        setStatus("Preparing your camera and microphone...");
        const { room } = await fetchRoom(roomId);
        setRequiresPassword(false);
        const meeting = await startMeeting(roomId);
        const stream = await getLocalMedia(mediaConstraints);

        if (!mounted) {
          stopStream(stream);
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        meetingRef.current = meeting;
        if (room?.hostId?._id === user?._id) {
          startRecording(stream);
        }

        const socket = connectSocket(token);
        socketRef.current = socket;

        socket.on("existing-users", async (existingUsers) => {
          setParticipants((current) => {
            const combined = [...existingUsers, ...current];
            return combined.filter((item, index, array) => array.findIndex((candidate) => candidate.socketId === item.socketId) === index);
          });

          await Promise.all(
            existingUsers.map(async (participant) => {
              const peerConnection = ensurePeerConnection(participant.socketId);
              const offer = await createOffer(peerConnection);
              sendSignal(participant.socketId, { description: offer });
            })
          );
        });

        socket.on("user-connected", (participant) => {
          setParticipants((current) => {
            if (current.some((item) => item.socketId === participant.socketId)) {
              return current;
            }
            return [...current, participant];
          });
        });

        socket.on("participants-updated", setParticipants);

        socket.on("user-disconnected", ({ socketId }) => {
          removePeer(socketId);
          setParticipants((current) => current.filter((participant) => participant.socketId !== socketId));
        });

        socket.on("webrtc-signal", async ({ from, signal }) => {
          const peerConnection = ensurePeerConnection(from);

          if (signal.description?.type === "offer") {
            const answer = await createAnswer(peerConnection, signal.description);
            sendSignal(from, { description: answer });
            await flushPendingIce(from);
          }

          if (signal.description?.type === "answer") {
            await acceptAnswer(peerConnection, signal.description);
            await flushPendingIce(from);
          }

          if (signal.candidate) {
            if (peerConnection.remoteDescription) {
              await addIceCandidate(peerConnection, signal.candidate).catch(() => {});
            } else {
              pendingIceRef.current[from] = [...(pendingIceRef.current[from] || []), signal.candidate];
            }
          }
        });

        socket.on("receive-message", appendMessage);

        socket.on("emoji-reaction", (payload) => {
          setReaction(payload);
          setTimeout(() => setReaction(null), 1800);
        });

        socket.on("host-muted-all", () => {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsMuted(true);
        });

        socket.on("removed-from-room", () => {
          navigate("/dashboard");
        });

        socket.emit("join-room", { roomId }, (response) => {
          if (!response?.ok) {
            setStatus(response?.message || "Unable to join room.");
            return;
          }
          setStatus("Connected");
        });
      } catch (error) {
        if (error.message?.toLowerCase().includes("private room")) {
          setRequiresPassword(true);
          setAccessError(error.message);
          setStatus("Private room requires a password.");
          return;
        }

        setStatus(error.message || "Unable to start meeting.");
      }
    };

    bootRoom();

    return () => {
      mounted = false;
      socketRef.current?.emit("leave-room", { roomId });
      Object.values(peerConnectionsRef.current).forEach((peerConnection) => peerConnection.close());
      peerConnectionsRef.current = {};
      stopRecording();
      stopStream(localStreamRef.current);
      disconnectSocket();
      resetCurrentMeeting();
    };
  }, [
    appendMessage,
    ensurePeerConnection,
    fetchRoom,
    flushPendingIce,
    navigate,
    removePeer,
    resetCurrentMeeting,
    roomId,
    sendSignal,
    startMeeting,
    startRecording,
    stopRecording,
    token,
    user?._id,
    joinNonce
  ]);

  const emitMediaState = (nextMuted = isMuted, nextVideoOff = isVideoOff) => {
    socketRef.current?.emit("media-state-changed", {
      roomId,
      isMuted: nextMuted,
      isVideoOff: nextVideoOff
    });
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
    emitMediaState(nextMuted, isVideoOff);
  };

  const toggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !nextVideoOff;
    });
    setIsVideoOff(nextVideoOff);
    emitMediaState(isMuted, nextVideoOff);
  };

  const toggleScreenShare = async () => {
    if (!localStream) {
      return;
    }

    if (isSharingScreen) {
      await restoreCamera();
      return;
    }

    const displayStream = await getDisplayMedia();
    const [screenTrack] = displayStream.getVideoTracks();
    screenTrack.onended = restoreCamera;
    await replaceVideoTrack(peerConnectionsRef.current, localStream, screenTrack);
    setIsSharingScreen(true);
  };

  const sendMessage = (message) => {
    socketRef.current?.emit("send-message", { roomId, message });
  };

  const sendReaction = (emoji) => {
    socketRef.current?.emit("emoji-reaction", { roomId, emoji });
  };

  const toggleRaiseHand = () => {
    const nextValue = !raisedHand;
    setRaisedHand(nextValue);
    socketRef.current?.emit("raise-hand", { roomId, raised: nextValue });
  };

  const handlePrivateRoomJoin = async (event) => {
    event.preventDefault();
    setAccessError("");

    try {
      await joinRoom(roomId, roomPassword);
      setRequiresPassword(false);
      setRoomPassword("");
      setJoinNonce((value) => value + 1);
    } catch (error) {
      setAccessError(error.message || "Invalid room password.");
    }
  };

  const leaveMeeting = async () => {
    stopRecording();
    if (isHost && meetingRef.current?._id) {
      await endMeeting(meetingRef.current._id).catch(() => {});
    }
    navigate("/dashboard");
  };

  const controls = [
    { label: isMuted ? "Unmute" : "Mute", onClick: toggleMute, danger: isMuted },
    { label: isVideoOff ? "Camera On" : "Camera Off", onClick: toggleVideo, danger: isVideoOff },
    { label: isSharingScreen ? "Stop Share" : "Share Screen", onClick: toggleScreenShare },
    { label: raisedHand ? "Lower Hand" : "Raise Hand", onClick: toggleRaiseHand },
    { label: "Leave", onClick: leaveMeeting, danger: true }
  ];

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
        <Navbar />
        <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
          <form onSubmit={handlePrivateRoomJoin} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Private meeting</p>
            <h1 className="mt-2 text-3xl font-black">Enter room password</h1>
            <p className="mt-3 text-sm text-slate-500">Meeting ID: {roomId}</p>
            {accessError && <p className="mt-4 rounded-2xl bg-rose-100 p-3 text-sm font-semibold text-rose-700">{accessError}</p>}
            <input
              className="field mt-6"
              type="password"
              value={roomPassword}
              onChange={(event) => setRoomPassword(event.target.value)}
              placeholder="Room password"
              minLength={4}
              required
            />
            <button className="primary-button mt-4 w-full" type="submit">
              Join private meeting
            </button>
            <button className="secondary-button mt-3 w-full" type="button" onClick={() => navigate("/dashboard")}>
              Back to dashboard
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-blue-600">{status}</p>
              <h1 className="text-2xl font-black">{currentRoom?.name || "Meeting Room"}</h1>
              <p className="text-sm text-slate-500">
                Meeting ID: {currentRoom?.meetingId || roomId}
                {currentMeeting?.startTime ? ` - Started ${new Date(currentMeeting.startTime).toLocaleTimeString()}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["👍", "👏", "🎉"].map((emoji) => (
                <button key={emoji} onClick={() => sendReaction(emoji)} type="button" className="rounded-full bg-slate-100 px-4 py-2 text-xl dark:bg-slate-800">
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <VideoPlayer stream={localStream} name={user?.name} muted isLocal isVideoOff={isVideoOff} />
            {Object.entries(remoteStreams).map(([socketId, stream]) => {
              const participant = participants.find((item) => item.socketId === socketId);
              return (
                <VideoPlayer
                  key={socketId}
                  stream={stream}
                  name={participant?.user?.name || "Participant"}
                  isVideoOff={participant?.isVideoOff}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {controls.map((control) => (
              <button
                key={control.label}
                onClick={control.onClick}
                type="button"
                className={`rounded-2xl px-5 py-3 font-bold text-white ${control.danger ? "bg-rose-600 hover:bg-rose-500" : "bg-slate-800 hover:bg-slate-700 dark:bg-slate-700"}`}
              >
                {control.label}
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          {reaction && (
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-center text-lg font-black text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
              {reaction.from?.name} reacted {reaction.emoji}
            </div>
          )}
          <ParticipantList
            participants={participants}
            currentUser={user}
            isHost={isHost}
            onMuteAll={() => socketRef.current?.emit("mute-all", { roomId })}
            onRemoveUser={(socketId) => socketRef.current?.emit("remove-user", { roomId, socketId })}
          />
          <ChatBox messages={messages} onSendMessage={sendMessage} currentUser={user} />
        </aside>
      </main>
    </div>
  );
};

export default Room;
