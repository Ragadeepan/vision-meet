export const ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
];

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

export const getLocalMedia = (constraints = mediaConstraints) => navigator.mediaDevices.getUserMedia(constraints);

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
