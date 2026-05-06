import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import api from "../services/api";
import { firebaseAuth, googleProvider } from "../services/firebase";
import { disconnectSocket } from "../services/socket";

const firebaseUserToProfile = (firebaseUser, fallback = {}) => ({
  _id: firebaseUser.uid,
  firebaseUid: firebaseUser.uid,
  name: firebaseUser.displayName || fallback.name || firebaseUser.email?.split("@")[0] || "Vision User",
  email: firebaseUser.email,
  phone: fallback.phone || firebaseUser.phoneNumber || ""
});

const formatAuthError = (error, fallbackMessage) => {
  const rawMessage = error?.message || fallbackMessage;
  const code = error?.code || rawMessage;

  if (code.includes("api-key-not-valid")) {
    return "Firebase API key is invalid. Paste the exact Firebase SDK config into client/.env and restart the Vite server.";
  }
  if (code.includes("unauthorized-domain")) {
    return "This domain is not authorized in Firebase Authentication. Add localhost to Firebase Auth authorized domains.";
  }
  if (code.includes("email-already-in-use")) {
    return "An account with this email already exists. Please log in instead.";
  }
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Invalid email or password.";
  }
  if (code.includes("popup-closed-by-user")) {
    return "Google sign-in was closed before it finished.";
  }
  if (code.includes("network-request-failed")) {
    return "Network error while contacting Firebase. Please check your connection.";
  }

  return rawMessage;
};

const syncFirebaseUser = async (firebaseUser, extraProfile = {}) => {
  const token = await firebaseUser.getIdToken();
  const fallbackUser = firebaseUserToProfile(firebaseUser, extraProfile);

  try {
    const { data } = await api.post("/auth/firebase/sync", extraProfile, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { token, user: data.user || fallbackUser };
  } catch (_error) {
    return { token, user: fallbackUser };
  }
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      authReady: false,
      loading: false,
      error: null,
      setAuth: ({ token, user }) => set({ token, user, error: null }),
      initializeAuth: () => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
          if (!firebaseUser) {
            set({ authReady: true });
            return;
          }

          const data = await syncFirebaseUser(firebaseUser);
          set({ token: data.token, user: data.user, authReady: true, error: null });
        });

        return unsubscribe;
      },
      signup: async (payload) => {
        set({ loading: true, error: null });
        try {
          const credential = await createUserWithEmailAndPassword(firebaseAuth, payload.email, payload.password);
          await updateProfile(credential.user, { displayName: payload.name });
          const data = await syncFirebaseUser(credential.user, {
            name: payload.name,
            phone: payload.phone
          });
          set({ token: data.token, user: data.user, loading: false });
          return data;
        } catch (error) {
          const message = formatAuthError(error, "Signup failed.");
          set({ error: message, loading: false });
          throw new Error(message);
        }
      },
      login: async (payload) => {
        set({ loading: true, error: null });
        try {
          const credential = await signInWithEmailAndPassword(firebaseAuth, payload.email, payload.password);
          const data = await syncFirebaseUser(credential.user);
          set({ token: data.token, user: data.user, loading: false });
          return data;
        } catch (error) {
          const message = formatAuthError(error, "Login failed.");
          set({ error: message, loading: false });
          throw new Error(message);
        }
      },
      loginWithGoogle: async () => {
        set({ loading: true, error: null });
        try {
          const credential = await signInWithPopup(firebaseAuth, googleProvider);
          const data = await syncFirebaseUser(credential.user);
          set({ token: data.token, user: data.user, loading: false });
          return data;
        } catch (error) {
          const message = formatAuthError(error, "Google login failed.");
          set({ error: message, loading: false });
          throw new Error(message);
        }
      },
      fetchMe: async () => {
        if (!get().token) {
          return null;
        }

        if (firebaseAuth.currentUser) {
          const data = await syncFirebaseUser(firebaseAuth.currentUser);
          set({ token: data.token, user: data.user, error: null });
          return data.user;
        }

        try {
          const { data } = await api.get("/auth/me");
          set({ user: data.user });
          return data.user;
        } catch (error) {
          const isUnauthorized = error.response?.status === 401;
          if (isUnauthorized) {
            await get().logout();
            return null;
          }

          // Keep the Firebase/persisted session alive if the API is offline during local setup.
          return get().user;
        }
      },
      logout: async () => {
        await signOut(firebaseAuth).catch(() => {});
        disconnectSocket();
        set({ token: null, user: null, error: null, authReady: true });
      }
    }),
    {
      name: "vision-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user
      })
    }
  )
);
