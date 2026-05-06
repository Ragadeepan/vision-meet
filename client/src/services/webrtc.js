const defaultIceServers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

const buildIceServers = () => {
  const turnUrls = (import.meta.env.VITE_TURN_SERVER_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (turnUrls.length === 0) {
    return defaultIceServers;
  }

  const turnServer = {
    urls: turnUrls
  };

  if (import.meta.env.VITE_TURN_USERNAME) {
    turnServer.username = import.meta.env.VITE_TURN_USERNAME;
  }

  if (import.meta.env.VITE_TURN_CREDENTIAL) {
    turnServer.credential = import.meta.env.VITE_TURN_CREDENTIAL;
  }

  return [...defaultIceServers, turnServer];
};

export const ICE_SERVERS = buildIceServers();

export const mediaConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  }
};

const withDeviceId = (constraints, deviceId) =>
  deviceId
    ? {
        ...constraints,
        deviceId: { exact: deviceId }
      }
    : constraints;

const buildMediaScenarios = ({ audioEnabled = true, videoEnabled = true, audioDeviceId = "", videoDeviceId = "" } = {}) => {
  const exactAudio = withDeviceId(mediaConstraints.audio, audioDeviceId);
  const exactVideo = withDeviceId(mediaConstraints.video, videoDeviceId);
  const anyAudio = mediaConstraints.audio;
  const anyVideo = mediaConstraints.video;
  const scenarios = [];

  if (audioEnabled && videoEnabled) {
    scenarios.push(
      { label: "camera-and-mic", constraints: { audio: exactAudio, video: exactVideo } },
      { label: "camera-and-mic", constraints: { audio: exactAudio, video: anyVideo } },
      { label: "camera-and-mic", constraints: { audio: anyAudio, video: exactVideo } },
      { label: "camera-and-mic", constraints: { audio: anyAudio, video: anyVideo } },
      { label: "mic-only", constraints: { audio: exactAudio, video: false } },
      { label: "mic-only", constraints: { audio: anyAudio, video: false } },
      { label: "camera-only", constraints: { audio: false, video: exactVideo } },
      { label: "camera-only", constraints: { audio: false, video: anyVideo } }
    );
  } else if (audioEnabled) {
    scenarios.push(
      { label: "mic-only", constraints: { audio: exactAudio, video: false } },
      { label: "mic-only", constraints: { audio: anyAudio, video: false } }
    );
  } else if (videoEnabled) {
    scenarios.push(
      { label: "camera-only", constraints: { audio: false, video: exactVideo } },
      { label: "camera-only", constraints: { audio: false, video: anyVideo } }
    );
  }

  return scenarios;
};

export const describeMediaError = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera or microphone permission was blocked. Allow access in the browser address bar and try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No usable camera or microphone was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Another app is already using your camera or microphone. Close it and try again.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "The selected camera or microphone is unavailable. Pick another device and try again.";
    case "SecurityError":
      return "Camera access requires a secure HTTPS page or localhost.";
    default:
      return error?.message || "Unable to access your camera or microphone right now.";
  }
};

export const getStreamProfile = (stream) => ({
  hasAudio: Boolean(stream?.getAudioTracks().length),
  hasVideo: Boolean(stream?.getVideoTracks().length)
});

export const getMediaModeLabel = (stream) => {
  const { hasAudio, hasVideo } = getStreamProfile(stream);

  if (hasAudio && hasVideo) {
    return "camera-and-mic";
  }
  if (hasAudio) {
    return "mic-only";
  }
  if (hasVideo) {
    return "camera-only";
  }
  return "chat-only";
};

export const requestLocalMedia = async (options = {}) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support camera or microphone access.");
  }

  const scenarios = buildMediaScenarios(options);
  let lastError = null;

  for (const scenario of scenarios) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(scenario.constraints);
      return {
        stream,
        mode: scenario.label,
        ...getStreamProfile(stream)
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(describeMediaError(lastError));
};

export const getLocalMedia = (constraints = mediaConstraints) => navigator.mediaDevices.getUserMedia(constraints);

export const listMediaDevices = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { audioInputs: [], videoInputs: [] };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();

  return {
    audioInputs: devices.filter((device) => device.kind === "audioinput"),
    videoInputs: devices.filter((device) => device.kind === "videoinput")
  };
};

export const getDisplayMedia = () =>
  navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true
  });

export const createPeerConnection = ({
  localStream,
  remoteSocketId,
  onIceCandidate,
  onRemoteStream,
  onConnectionStateChange
}) => {
  const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const remoteStream = new MediaStream();

  localStream?.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(remoteSocketId, event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    onRemoteStream?.(remoteSocketId, remoteStream);
  };

  peerConnection.onconnectionstatechange = () => {
    onConnectionStateChange?.(remoteSocketId, peerConnection.connectionState);
  };

  return peerConnection;
};

export const createOffer = async (peerConnection) => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  return peerConnection.localDescription;
};

export const createAnswer = async (peerConnection, offer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return peerConnection.localDescription;
};

export const acceptAnswer = (peerConnection, answer) =>
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

export const addIceCandidate = (peerConnection, candidate) =>
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

export const replaceAudioTrack = async (peerConnections, localStream, nextAudioTrack) => {
  const [oldTrack] = localStream.getAudioTracks();

  if (oldTrack) {
    localStream.removeTrack(oldTrack);
    oldTrack.stop();
  }

  localStream.addTrack(nextAudioTrack);

  await Promise.all(
    Object.values(peerConnections).map(async (peerConnection) => {
      const sender = peerConnection.getSenders().find((item) => item.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(nextAudioTrack);
      }
    })
  );
};

export const replaceVideoTrack = async (peerConnections, localStream, nextVideoTrack) => {
  const [oldTrack] = localStream.getVideoTracks();

  if (oldTrack) {
    localStream.removeTrack(oldTrack);
    oldTrack.stop();
  }

  localStream.addTrack(nextVideoTrack);

  await Promise.all(
    Object.values(peerConnections).map(async (peerConnection) => {
      const sender = peerConnection.getSenders().find((item) => item.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(nextVideoTrack);
      }
    })
  );
};

export const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop());
};
