import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import MeetingLobby from "../components/MeetingLobby";
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
  getMediaModeLabel,
  listMediaDevices,
  replaceAudioTrack,
  replaceVideoTrack,
  requestLocalMedia,
  stopStream
} from "../services/webrtc";
import { useAuthStore } from "../store/authStore";
import { useMeetingStore } from "../store/meetingStore";

const recorderMimeTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const reactionOptions = ["👍", "👏", "🎉", "🔥", "🚀"];
const socketEvents = [
  "existing-users",
  "user-connected",
  "participants-updated",
  "user-disconnected",
  "webrtc-signal",
  "receive-message",
  "emoji-reaction",
  "host-muted-all",
  "removed-from-room"
];
const audioPreferenceKey = "vision-preferred-audio-input";
const videoPreferenceKey = "vision-preferred-video-input";

const getSupportedRecorderType = () => recorderMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";

const getStoredPreference = (key) => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) || "";
};

const storePreference = (key, value) => {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.localStorage.setItem(key, value);
    return;
  }

  window.localStorage.removeItem(key);
};

const formatElapsed = (startTime, now) => {
  if (!startTime) {
    return "Starting soon";
  }

  const diff = Math.max(0, now - new Date(startTime).getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

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
  const [status, setStatus] = useState("Loading meeting details...");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [raisedHand, setRaisedHand] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [joinNonce, setJoinNonce] = useState(0);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);
  const [hasJoinedMeeting, setHasJoinedMeeting] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [mediaMode, setMediaMode] = useState("chat-only");
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(() => getStoredPreference(audioPreferenceKey));
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(() => getStoredPreference(videoPreferenceKey));
  const [inviteNotice, setInviteNotice] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [focusedTileId, setFocusedTileId] = useState("local");
  const [meetingNow, setMeetingNow] = useState(Date.now());
  const [isRecording, setIsRecording] = useState(false);

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
  const localMutedRef = useRef(false);

  const isHost = useMemo(() => currentRoom?.hostId?._id === user?._id, [currentRoom, user]);
  const localParticipant = useMemo(
    () => participants.find((participant) => participant.user?._id === user?._id),
    [participants, user?._id]
  );
  const participantCount = Math.max(1, participants.length || 0);

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

  useEffect(() => {
    localMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    storePreference(audioPreferenceKey, selectedAudioDeviceId);
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    storePreference(videoPreferenceKey, selectedVideoDeviceId);
  }, [selectedVideoDeviceId]);

  useEffect(() => {
    if (!currentMeeting?.startTime || !hasJoinedMeeting) {
      return undefined;
    }

    setMeetingNow(Date.now());
    const interval = window.setInterval(() => setMeetingNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [currentMeeting?.startTime, hasJoinedMeeting]);

  const refreshDeviceLists = useCallback(async () => {
    const { audioInputs, videoInputs } = await listMediaDevices();
    setAudioDevices(audioInputs);
    setVideoDevices(videoInputs);
  }, []);

  useEffect(() => {
    refreshDeviceLists().catch(() => {});
  }, [refreshDeviceLists]);

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

      recordingChunksRef.current = [];
      recordingUploadedRef.current = false;
      setIsRecording(true);

      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context || !canvas.captureStream) {
        setIsRecording(false);
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
          context.fillStyle = "#22d3ee";
          context.beginPath();
          context.arc(x + width / 2, y + height / 2, Math.min(width, height) / 7, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#04111d";
          context.font = "bold 44px sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(name?.slice(0, 1)?.toUpperCase() || "U", x + width / 2, y + height / 2);
        }

        context.fillStyle = "rgba(2, 6, 23, 0.72)";
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
        recorderRef.current = null;
        setIsRecording(false);

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
    [uploadRecording, user?.name]
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }

    recordingCleanupRef.current?.();
    recordingCleanupRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  const detachSocketListeners = useCallback((socket) => {
    if (!socket) {
      return;
    }

    socketEvents.forEach((eventName) => socket.off(eventName));
  }, []);

  const addTrackToPeers = useCallback(
    async (kind, track) => {
      if (!localStreamRef.current || !track) {
        return;
      }

      await Promise.all(
        Object.entries(peerConnectionsRef.current).map(async ([socketId, peerConnection]) => {
          const sender = peerConnection.getSenders().find((item) => item.track?.kind === kind);
          if (sender) {
            await sender.replaceTrack(track);
            return;
          }

          peerConnection.addTrack(track, localStreamRef.current);
          const offer = await createOffer(peerConnection);
          sendSignal(socketId, { description: offer });
        })
      );
    },
    [sendSignal]
  );

  const preparePreview = useCallback(async () => {
    setIsPreparingPreview(true);
    setMediaError("");

    try {
      const result = await requestLocalMedia({
        audioEnabled: true,
        videoEnabled: true,
        audioDeviceId: selectedAudioDeviceId,
        videoDeviceId: selectedVideoDeviceId
      });

      stopStream(localStreamRef.current);
      localStreamRef.current = result.stream;
      result.stream.getAudioTracks().forEach((track) => {
        track.enabled = !localMutedRef.current;
      });
      result.stream.getVideoTracks().forEach((track) => {
        track.enabled = !localVideoOffRef.current;
      });

      const nextMuted = result.hasAudio ? localMutedRef.current : true;
      const nextVideoOff = result.hasVideo ? localVideoOffRef.current : true;

      setLocalStream(result.stream);
      setIsMuted(nextMuted);
      setIsVideoOff(nextVideoOff);
      setMediaMode(result.mode || getMediaModeLabel(result.stream));
      setStatus(
        result.mode === "camera-and-mic"
          ? "Preview ready. Join when you're ready."
          : "Preview ready with fallback media. You can still join the meeting."
      );
    } catch (error) {
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
      setIsMuted(true);
      setIsVideoOff(true);
      setMediaMode("chat-only");
      setMediaError(error.message || "Unable to start your preview.");
      setStatus("Preview unavailable. Retry devices or join without camera for now.");
    } finally {
      setIsPreparingPreview(false);
      refreshDeviceLists().catch(() => {});
    }
  }, [refreshDeviceLists, selectedAudioDeviceId, selectedVideoDeviceId]);

  const recoverTrack = useCallback(
    async (kind) => {
      setMediaError("");
      setStatus(kind === "video" ? "Reconnecting camera..." : "Reconnecting microphone...");

      try {
        const result = await requestLocalMedia({
          audioEnabled: kind === "audio",
          videoEnabled: kind === "video",
          audioDeviceId: selectedAudioDeviceId,
          videoDeviceId: selectedVideoDeviceId
        });
        const recoveredTrack = kind === "audio" ? result.stream.getAudioTracks()[0] : result.stream.getVideoTracks()[0];

        if (!recoveredTrack) {
          throw new Error(kind === "audio" ? "Microphone recovery failed." : "Camera recovery failed.");
        }

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
          setLocalStream(localStreamRef.current);
        }

        if (kind === "audio") {
          recoveredTrack.enabled = true;
          if (localStreamRef.current.getAudioTracks().length > 0) {
            await replaceAudioTrack(peerConnectionsRef.current, localStreamRef.current, recoveredTrack);
          } else {
            localStreamRef.current.addTrack(recoveredTrack);
            await addTrackToPeers("audio", recoveredTrack);
          }
          setIsMuted(false);
        } else {
          recoveredTrack.enabled = true;
          if (localStreamRef.current.getVideoTracks().length > 0) {
            await replaceVideoTrack(peerConnectionsRef.current, localStreamRef.current, recoveredTrack);
          } else {
            localStreamRef.current.addTrack(recoveredTrack);
            await addTrackToPeers("video", recoveredTrack);
          }
          setIsVideoOff(false);
        }

        setMediaMode(getMediaModeLabel(localStreamRef.current));
        setStatus(kind === "audio" ? "Microphone reconnected." : "Camera reconnected.");
        refreshDeviceLists().catch(() => {});
      } catch (error) {
        setMediaError(error.message || "Unable to reconnect the selected device.");
        setStatus(error.message || "Unable to reconnect the selected device.");
      }
    },
    [addTrackToPeers, refreshDeviceLists, selectedAudioDeviceId, selectedVideoDeviceId]
  );

  const restoreCamera = useCallback(async () => {
    if (!localStreamRef.current || restoringCameraRef.current) {
      return;
    }

    restoringCameraRef.current = true;

    try {
      const result = await requestLocalMedia({
        audioEnabled: false,
        videoEnabled: true,
        videoDeviceId: selectedVideoDeviceId
      });
      const [cameraTrack] = result.stream.getVideoTracks();

      if (!cameraTrack) {
        throw new Error("Camera could not be restored.");
      }

      if (localStreamRef.current.getVideoTracks().length > 0) {
        await replaceVideoTrack(peerConnectionsRef.current, localStreamRef.current, cameraTrack);
      } else {
        localStreamRef.current.addTrack(cameraTrack);
        await addTrackToPeers("video", cameraTrack);
      }

      cameraTrack.enabled = !localVideoOffRef.current;
      setIsSharingScreen(false);
      setStatus("Camera restored.");
      setMediaMode(getMediaModeLabel(localStreamRef.current));
    } catch (error) {
      setMediaError(error.message || "Unable to restore your camera.");
      setStatus(error.message || "Unable to restore your camera.");
    } finally {
      restoringCameraRef.current = false;
    }
  }, [addTrackToPeers, selectedVideoDeviceId]);

  const bindSocketListeners = useCallback(
    (socket) => {
      detachSocketListeners(socket);

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
        window.setTimeout(() => setReaction(null), 1800);
      });

      socket.on("host-muted-all", () => {
        localStreamRef.current?.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        setIsMuted(true);
      });

      socket.on("removed-from-room", () => {
        navigate("/dashboard");
      });
    },
    [appendMessage, detachSocketListeners, ensurePeerConnection, flushPendingIce, navigate, removePeer, sendSignal]
  );

  const joinMeetingCall = useCallback(async () => {
    if (isJoiningMeeting || hasJoinedMeeting) {
      return;
    }

    setIsJoiningMeeting(true);
    setMediaError("");
    setStatus("Connecting to the meeting...");

    try {
      const meeting = await startMeeting(roomId);
      meetingRef.current = meeting;

      const socket = connectSocket(token);
      socketRef.current = socket;
      bindSocketListeners(socket);

      await new Promise((resolve, reject) => {
        socket.emit("join-room", { roomId }, (response) => {
          if (!response?.ok) {
            reject(new Error(response?.message || "Unable to join room."));
            return;
          }
          resolve(response);
        });
      });

      if (isHost && localStreamRef.current) {
        startRecording(localStreamRef.current);
      }

      setHasJoinedMeeting(true);
      setStatus("Connected");
    } catch (error) {
      setMediaError(error.message || "Unable to join the meeting.");
      setStatus(error.message || "Unable to join the meeting.");
    } finally {
      setIsJoiningMeeting(false);
    }
  }, [bindSocketListeners, hasJoinedMeeting, isHost, isJoiningMeeting, roomId, startMeeting, startRecording, token]);

  useEffect(() => {
    let mounted = true;

    const loadRoom = async () => {
      try {
        setAccessError("");
        setMediaError("");
        setRoomLoaded(false);
        setStatus("Loading meeting details...");

        await fetchRoom(roomId);
        if (!mounted) {
          return;
        }

        setRequiresPassword(false);
        setRoomLoaded(true);
        setStatus("Preview your setup before joining.");
      } catch (error) {
        if (!mounted) {
          return;
        }

        if (error.message?.toLowerCase().includes("private room")) {
          setRequiresPassword(true);
          setAccessError(error.message);
          setStatus("Private room requires a password.");
          return;
        }

        setAccessError(error.message || "Unable to load this room.");
        setStatus(error.message || "Unable to load this room.");
      }
    };

    loadRoom();

    return () => {
      mounted = false;
    };
  }, [fetchRoom, roomId, joinNonce]);

  useEffect(() => {
    if (!roomLoaded || requiresPassword || hasJoinedMeeting) {
      return;
    }

    preparePreview().catch(() => {});
  }, [hasJoinedMeeting, preparePreview, requiresPassword, roomLoaded]);

  useEffect(() => {
    return () => {
      socketRef.current?.emit("leave-room", { roomId });
      detachSocketListeners(socketRef.current);
      Object.values(peerConnectionsRef.current).forEach((peerConnection) => peerConnection.close());
      peerConnectionsRef.current = {};
      stopRecording();
      stopStream(localStreamRef.current);
      disconnectSocket();
      resetCurrentMeeting();
    };
  }, [detachSocketListeners, resetCurrentMeeting, roomId, stopRecording]);

  const emitMediaState = useCallback(
    (nextMuted = isMuted, nextVideoOff = isVideoOff) => {
      socketRef.current?.emit("media-state-changed", {
        roomId,
        isMuted: nextMuted,
        isVideoOff: nextVideoOff
      });
    },
    [isMuted, isVideoOff, roomId]
  );

  const toggleMute = async () => {
    const audioTracks = localStreamRef.current?.getAudioTracks() || [];
    if (audioTracks.length === 0 && isMuted) {
      await recoverTrack("audio");
      emitMediaState(false, isVideoOff);
      return;
    }

    const nextMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
    emitMediaState(nextMuted, isVideoOff);
  };

  const toggleVideo = async () => {
    const videoTracks = localStreamRef.current?.getVideoTracks() || [];
    if (videoTracks.length === 0 && isVideoOff) {
      await recoverTrack("video");
      emitMediaState(isMuted, false);
      return;
    }

    const nextVideoOff = !isVideoOff;
    videoTracks.forEach((track) => {
      track.enabled = !nextVideoOff;
    });
    setIsVideoOff(nextVideoOff);
    emitMediaState(isMuted, nextVideoOff);
  };

  const toggleScreenShare = async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
      setLocalStream(localStreamRef.current);
    }

    if (isSharingScreen) {
      await restoreCamera();
      return;
    }

    try {
      const displayStream = await getDisplayMedia();
      const [screenTrack] = displayStream.getVideoTracks();

      if (!screenTrack) {
        throw new Error("Screen sharing is unavailable.");
      }

      if (localStreamRef.current.getVideoTracks().length > 0) {
        await replaceVideoTrack(peerConnectionsRef.current, localStreamRef.current, screenTrack);
      } else {
        localStreamRef.current.addTrack(screenTrack);
        await addTrackToPeers("video", screenTrack);
      }

      screenTrack.onended = restoreCamera;
      setIsSharingScreen(true);
      setIsVideoOff(false);
      setStatus("Screen sharing is live.");
    } catch (error) {
      setMediaError(error.message || "Unable to share your screen.");
      setStatus(error.message || "Unable to share your screen.");
    }
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

  const copyInvite = async () => {
    const inviteUrl = `${window.location.origin}/room/${currentRoom?.meetingId || roomId}`;
    await navigator.clipboard.writeText(inviteUrl);
    setInviteNotice("Invite link copied");
    window.setTimeout(() => setInviteNotice(""), 2200);
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

  const tiles = useMemo(() => {
    const remoteTiles = Object.entries(remoteStreams).map(([socketId, stream]) => {
      const participant = participants.find((item) => item.socketId === socketId);
      return {
        id: socketId,
        stream,
        name: participant?.user?.name || "Participant",
        badge: participant?.role === "host" ? "Host" : "Live",
        subtitle: participant?.role === "host" ? "Room host" : "Connected",
        isLocal: false,
        isMuted: participant?.isMuted,
        isVideoOff: participant?.isVideoOff,
        raisedHand: participant?.raisedHand
      };
    });

    return [
      {
        id: "local",
        stream: localStream,
        name: user?.name || "You",
        badge: isHost ? "Host" : "You",
        subtitle: isSharingScreen ? "Presenting screen" : "Your live preview",
        isLocal: true,
        isMuted,
        isVideoOff,
        raisedHand: raisedHand || localParticipant?.raisedHand
      },
      ...remoteTiles
    ];
  }, [isHost, isMuted, isSharingScreen, isVideoOff, localParticipant?.raisedHand, localStream, participants, raisedHand, remoteStreams, user?.name]);

  useEffect(() => {
    if (tiles.some((tile) => tile.id === focusedTileId)) {
      return;
    }

    setFocusedTileId(tiles[0]?.id || "local");
  }, [focusedTileId, tiles]);

  const focusedTile = useMemo(
    () => tiles.find((tile) => tile.id === focusedTileId) || tiles[0],
    [focusedTileId, tiles]
  );
  const secondaryTiles = useMemo(
    () => tiles.filter((tile) => tile.id !== focusedTile?.id),
    [focusedTile?.id, tiles]
  );

  const controls = [
    { label: isMuted ? "Turn Mic On" : "Mute Mic", onClick: toggleMute, danger: isMuted },
    { label: isVideoOff ? "Turn Camera On" : "Turn Camera Off", onClick: toggleVideo, danger: isVideoOff },
    { label: isSharingScreen ? "Stop Share" : "Share Screen", onClick: toggleScreenShare },
    { label: raisedHand ? "Lower Hand" : "Raise Hand", onClick: toggleRaiseHand },
    { label: "Copy Invite", onClick: copyInvite },
    { label: "Leave", onClick: leaveMeeting, danger: true }
  ];

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
        <Navbar />
        <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
          <form onSubmit={handlePrivateRoomJoin} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Private meeting</p>
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

  if (!roomLoaded && accessError) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
        <Navbar />
        <main className="mx-auto flex max-w-lg flex-col justify-center px-4 py-16">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-500">Room unavailable</p>
            <h1 className="mt-3 text-3xl font-black">We couldn&apos;t open this meeting.</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{accessError}</p>
            <div className="mt-6 flex gap-3">
              <button className="primary-button" type="button" onClick={() => setJoinNonce((value) => value + 1)}>
                Retry
              </button>
              <button className="secondary-button" type="button" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!hasJoinedMeeting) {
    if (!roomLoaded) {
      return (
        <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
          <Navbar />
          <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Loading room</p>
              <h1 className="mt-3 text-3xl font-black">Getting your meeting ready...</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{status}</p>
            </div>
          </main>
        </div>
      );
    }

    return (
      <MeetingLobby
        room={currentRoom}
        roomId={roomId}
        user={user}
        localStream={localStream}
        status={status}
        mediaMode={mediaMode}
        mediaError={mediaError}
        isPreparingPreview={isPreparingPreview}
        isJoining={isJoiningMeeting}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioDeviceId={selectedAudioDeviceId}
        selectedVideoDeviceId={selectedVideoDeviceId}
        onSelectAudioDevice={setSelectedAudioDeviceId}
        onSelectVideoDevice={setSelectedVideoDeviceId}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onRetryPreview={preparePreview}
        onJoinMeeting={joinMeetingCall}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_20%),linear-gradient(180deg,_#eef6ff_0%,_#f8fafc_55%,_#f8fafc_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_18%),linear-gradient(180deg,_#020617_0%,_#020617_50%,_#0f172a_100%)] dark:text-white">
      <Navbar />
      <main className="mx-auto grid max-w-[1680px] gap-4 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/78 p-5 shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-slate-900/74">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300">{status}</p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">{currentRoom?.name || "Meeting Room"}</h1>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                  Meeting ID: {currentRoom?.meetingId || roomId}
                  {currentMeeting?.startTime ? ` • Live for ${formatElapsed(currentMeeting.startTime, meetingNow)}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {reactionOptions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    type="button"
                    className="rounded-full bg-slate-100 px-4 py-2 text-xl transition hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Participants", value: participantCount.toString() },
                { label: "Layout", value: viewMode === "grid" ? "Grid mode" : "Focus mode" },
                { label: "Recording", value: isRecording ? "Recording live" : "Not recording" },
                { label: "Media mode", value: mediaMode.replace(/-/g, " ") }
              ].map((item) => (
                <div key={item.label} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                  <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>

            {(inviteNotice || mediaError) && (
              <div className={`mt-5 rounded-[1.4rem] px-4 py-3 text-sm font-semibold ${mediaError ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"}`}>
                {inviteNotice || mediaError}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${viewMode === "grid" ? "bg-slate-950 text-white dark:bg-cyan-400 dark:text-slate-950" : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              Grid Layout
            </button>
            <button
              type="button"
              onClick={() => setViewMode("focus")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${viewMode === "focus" ? "bg-slate-950 text-white dark:bg-cyan-400 dark:text-slate-950" : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              Focus Layout
            </button>
            {!localStreamRef.current?.getVideoTracks().length && (
              <button type="button" onClick={() => recoverTrack("video")} className="secondary-button">
                Retry Camera
              </button>
            )}
            {!localStreamRef.current?.getAudioTracks().length && (
              <button type="button" onClick={() => recoverTrack("audio")} className="secondary-button">
                Retry Mic
              </button>
            )}
          </div>

          {viewMode === "focus" && focusedTile ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <VideoPlayer
                stream={focusedTile.stream}
                name={focusedTile.name}
                muted={focusedTile.isLocal}
                isMuted={focusedTile.isMuted}
                isLocal={focusedTile.isLocal}
                isVideoOff={focusedTile.isVideoOff}
                badge={focusedTile.badge}
                subtitle={focusedTile.subtitle}
                raisedHand={focusedTile.raisedHand}
                isHighlighted
                onSelect={() => setFocusedTileId(focusedTile.id)}
              />

              <div className="grid max-h-[760px] gap-4 overflow-auto pr-1">
                {secondaryTiles.map((tile) => (
                  <VideoPlayer
                    key={tile.id}
                    stream={tile.stream}
                    name={tile.name}
                    muted={tile.isLocal}
                    isMuted={tile.isMuted}
                    isLocal={tile.isLocal}
                    isVideoOff={tile.isVideoOff}
                    badge={tile.badge}
                    subtitle={tile.subtitle}
                    raisedHand={tile.raisedHand}
                    isHighlighted={tile.id === focusedTileId}
                    onSelect={() => setFocusedTileId(tile.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {tiles.map((tile) => (
                <VideoPlayer
                  key={tile.id}
                  stream={tile.stream}
                  name={tile.name}
                  muted={tile.isLocal}
                  isMuted={tile.isMuted}
                  isLocal={tile.isLocal}
                  isVideoOff={tile.isVideoOff}
                  badge={tile.badge}
                  subtitle={tile.subtitle}
                  raisedHand={tile.raisedHand}
                  isHighlighted={tile.id === focusedTileId}
                  onSelect={() => setFocusedTileId(tile.id)}
                />
              ))}
            </div>
          )}

          <div className="rounded-[2rem] border border-white/60 bg-white/78 p-4 shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-slate-900/74">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {controls.map((control) => (
                <button
                  key={control.label}
                  onClick={control.onClick}
                  type="button"
                  className={`rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                    control.danger
                      ? "bg-rose-600 text-white hover:bg-rose-500"
                      : "bg-slate-950 text-white hover:bg-slate-800 dark:bg-slate-700"
                  }`}
                >
                  {control.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          {reaction && (
            <div className="rounded-[1.8rem] border border-cyan-200 bg-cyan-50 p-4 text-center text-lg font-black text-cyan-700 dark:border-cyan-900 dark:bg-cyan-500/15 dark:text-cyan-200">
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
