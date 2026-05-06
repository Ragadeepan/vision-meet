import { io } from "socket.io-client";
import { apiBaseUrl } from "./api";

let socket;

export const connectSocket = (token) => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(apiBaseUrl, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
};
