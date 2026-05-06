import { create } from "zustand";
import api from "../services/api";

export const useMeetingStore = create((set, get) => ({
  rooms: [],
  history: [],
  currentRoom: null,
  currentMeeting: null,
  messages: [],
  loading: false,
  error: null,
  darkMode: localStorage.getItem("vision-theme") === "dark",
  hydrateTheme: () => {
    const enabled = get().darkMode;
    document.documentElement.classList.toggle("dark", enabled);
  },
  toggleDarkMode: () => {
    const nextValue = !get().darkMode;
    localStorage.setItem("vision-theme", nextValue ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextValue);
    set({ darkMode: nextValue });
  },
  createRoom: async (payload) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/rooms", payload);
      set((state) => ({ rooms: [data.room, ...state.rooms], loading: false }));
      return data.room;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to create meeting.";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },
  fetchRooms: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get("/rooms");
      set({ rooms: data.rooms, loading: false });
      return data.rooms;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load rooms.";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },
  fetchRoom: async (roomId) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get(`/rooms/${roomId}`);
      set({ currentRoom: data.room, messages: data.messages, loading: false });
      return data;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load room.";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },
  joinRoom: async (roomId, password = "") => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post(`/rooms/${roomId}/join`, { password });
      set({ currentRoom: data.room, loading: false });
      return data.room;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to join room.";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },
  startMeeting: async (roomId) => {
    const { data } = await api.post(`/meetings/${roomId}/start`);
    set({ currentMeeting: data.meeting });
    return data.meeting;
  },
  endMeeting: async (meetingId) => {
    const { data } = await api.patch(`/meetings/${meetingId}/end`);
    set({ currentMeeting: data.meeting });
    return data.meeting;
  },
  uploadRecording: async (meetingId, blob) => {
    const formData = new FormData();
    formData.append("recording", blob, `vision-meeting-${meetingId}.webm`);
    const { data } = await api.post(`/meetings/${meetingId}/recording`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    set({ currentMeeting: data.meeting });
    return data;
  },
  fetchHistory: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get("/meetings/history");
      set({ history: data.meetings, loading: false });
      return data.meetings;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load meeting history.";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },
  appendMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  resetCurrentMeeting: () => set({ currentRoom: null, currentMeeting: null, messages: [] })
}));
