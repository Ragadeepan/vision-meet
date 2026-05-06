import axios from "axios";
import { firebaseAuth } from "./firebase";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`,
  withCredentials: true
});

api.interceptors.request.use(async (config) => {
  const auth = JSON.parse(localStorage.getItem("vision-auth") || "{}");
  const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : auth?.state?.token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default api;
