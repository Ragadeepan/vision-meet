# Vision Meeting Project Overview

## What This Project Is

Vision Meeting is a full-stack video conferencing application with:

- a React + Vite frontend
- a Node.js + Express backend
- Socket.io for real-time room events
- WebRTC for peer-to-peer audio and video
- MongoDB for users, rooms, meetings, and chat history
- Firebase Authentication for the primary login flow
- Cloudinary for meeting recording uploads

The app supports:

- email/password signup and login through Firebase
- Google sign-in through Firebase
- optional backend Google OAuth routes through Passport
- room creation and joining
- live chat
- participant list and host controls
- mute, camera toggle, screen share, raise hand, emoji reactions
- host-side browser recording upload
- meeting history with recording playback

## Runtime Architecture

The application is split into two runtime parts:

1. `client/` handles the React UI, routing, state management, Firebase Auth, WebRTC peer setup, and Socket.io client work.
2. `server/` handles the REST API, token verification, MongoDB persistence, Socket.io server behavior, and Cloudinary upload handling.

High-level flow:

1. User signs in on the frontend.
2. Frontend gets a Firebase ID token.
3. Frontend sends that token to the backend in the `Authorization` header.
4. Backend verifies the token and creates or syncs the MongoDB user.
5. User creates or joins a room through REST endpoints.
6. User enters the meeting room and connects to Socket.io.
7. Socket.io coordinates presence, chat, host actions, and WebRTC signaling.
8. WebRTC streams audio and video directly between participants.
9. Host can upload the recording to Cloudinary and later view it in history.

## Repository Structure

```text
Vision meet 1/
|- README.md
|- package.json
|- package-lock.json
|- .gitignore
|- client/
|  |- .env.example
|  |- package.json
|  |- vite.config.js
|  |- tailwind.config.js
|  |- postcss.config.js
|  |- src/
|     |- main.jsx
|     |- App.jsx
|     |- index.css
|     |- components/
|     |  |- Navbar.jsx
|     |  |- Sidebar.jsx
|     |  |- VideoPlayer.jsx
|     |  |- ParticipantList.jsx
|     |  |- ChatBox.jsx
|     |- pages/
|     |  |- Landing.jsx
|     |  |- Login.jsx
|     |  |- Signup.jsx
|     |  |- Dashboard.jsx
|     |  |- Room.jsx
|     |  |- MeetingHistory.jsx
|     |- services/
|     |  |- api.js
|     |  |- firebase.js
|     |  |- socket.js
|     |  |- webrtc.js
|     |- store/
|        |- authStore.js
|        |- meetingStore.js
|- server/
|  |- .env.example
|  |- package.json
|  |- server.js
|  |- config/
|  |  |- db.js
|  |  |- cloudinary.js
|  |  |- firebaseAdmin.js
|  |  |- passport.js
|  |- controllers/
|  |  |- authController.js
|  |  |- roomController.js
|  |  |- meetingController.js
|  |- middleware/
|  |  |- authMiddleware.js
|  |- models/
|  |  |- User.js
|  |  |- Room.js
|  |  |- Meeting.js
|  |  |- Message.js
|  |- routes/
|  |  |- authRoutes.js
|  |  |- roomRoutes.js
|  |  |- meetingRoutes.js
|  |- socket/
|     |- socketHandler.js
|- docs/
   |- 01-project-overview.md
   |- 02-api-and-socket-reference.md
   |- 03-improvement-guide.md
```

## Frontend File Map

| File | Responsibility |
| --- | --- |
| `client/src/main.jsx` | React entrypoint |
| `client/src/App.jsx` | Router, protected routes, auth bootstrap, theme hydration |
| `client/src/store/authStore.js` | Firebase login/signup/logout, persisted auth state, backend sync |
| `client/src/store/meetingStore.js` | Rooms, meeting history, room loading, message list, dark mode |
| `client/src/services/api.js` | Axios instance, base URL, auth header injection |
| `client/src/services/firebase.js` | Firebase SDK setup |
| `client/src/services/socket.js` | Socket.io client connect/disconnect |
| `client/src/services/webrtc.js` | Media access, RTCPeerConnection helpers, screen sharing helpers |
| `client/src/pages/Landing.jsx` | Public marketing page and quick join form |
| `client/src/pages/Login.jsx` | Firebase login UI |
| `client/src/pages/Signup.jsx` | Firebase signup UI |
| `client/src/pages/Dashboard.jsx` | Room creation, room joining, room listing |
| `client/src/pages/Room.jsx` | Main meeting experience, media controls, signaling, recording, chat |
| `client/src/pages/MeetingHistory.jsx` | Completed meetings and recordings |
| `client/src/components/*.jsx` | Shared UI for nav, sidebar, video tile, chat, participants |
| `client/src/index.css` | Tailwind base plus shared button and input utility classes |

## Backend File Map

| File | Responsibility |
| --- | --- |
| `server/server.js` | Express app boot, middleware, routes, Socket.io server |
| `server/config/db.js` | MongoDB connection |
| `server/config/firebaseAdmin.js` | Firebase Admin token verification |
| `server/config/passport.js` | Optional backend Google OAuth strategy |
| `server/config/cloudinary.js` | Recording upload helper |
| `server/middleware/authMiddleware.js` | Accepts either backend JWT or Firebase ID token |
| `server/controllers/authController.js` | Legacy JWT auth endpoints and Firebase user sync |
| `server/controllers/roomController.js` | Room CRUD and room access rules |
| `server/controllers/meetingController.js` | Meeting start/end, recording upload, history |
| `server/socket/socketHandler.js` | Realtime presence, chat, host actions, signaling |
| `server/models/User.js` | User schema and password hashing |
| `server/models/Room.js` | Room schema, meeting ID generation, password hashing |
| `server/models/Meeting.js` | Meeting lifecycle and recording metadata |
| `server/models/Message.js` | Stored room chat messages |

## Current Auth Design

There are two auth styles in the backend, but only one is primary in the current UI.

### Primary auth path used by the current frontend

1. Frontend signs in with Firebase Auth.
2. Frontend gets a Firebase ID token.
3. Frontend sends that token to backend endpoints.
4. Backend verifies the Firebase token in `authMiddleware.js`.
5. Backend creates or updates the MongoDB user if needed.

This flow is driven from:

- `client/src/store/authStore.js`
- `client/src/services/firebase.js`
- `server/middleware/authMiddleware.js`
- `server/controllers/authController.js`

### Legacy or fallback backend auth path

The backend also exposes:

- `POST /api/auth/signup`
- `POST /api/auth/login`

These routes generate backend JWTs, but the current React pages do not call them. They are still useful if you later want:

- non-Firebase login
- API-only clients
- admin tools
- a fallback auth mode

If you want one clean auth model, this is one of the best places to simplify the project.

## Main User Flows

### 1. Signup and Login

- `Signup.jsx` and `Login.jsx` call actions in `authStore.js`.
- Auth happens through Firebase email/password or Google popup.
- After sign-in, the frontend calls `/api/auth/firebase/sync`.
- User data is persisted in Zustand local storage under `vision-auth`.

### 2. Create or Join Room

- `Dashboard.jsx` uses `meetingStore.createRoom`, `fetchRooms`, and `joinRoom`.
- Rooms are created in MongoDB through `roomController.createRoom`.
- Each room receives a generated `meetingId` such as `A1B2C3D4`.
- Private rooms require a password.

### 3. Join Live Meeting

- `Room.jsx` loads room details through REST.
- It then starts or resumes a meeting through `/api/meetings/:roomId/start`.
- Local camera and microphone are requested through WebRTC helpers.
- Socket.io connection is created with the auth token.
- Existing users receive WebRTC offers and answers through Socket.io signaling.

### 4. Live Realtime Features

Socket events support:

- participant presence
- chat messages
- mute all
- remove user
- emoji reactions
- raise hand
- media state tracking
- WebRTC offer, answer, and ICE candidate exchange

### 5. Recording and History

- The host starts a browser `MediaRecorder` session in `Room.jsx`.
- The app composites participant video tiles into a canvas.
- Available audio tracks are mixed into one output stream.
- On stop, the recording is uploaded to Cloudinary through the backend.
- `MeetingHistory.jsx` loads recordings from `/api/meetings/history`.

## Local Setup and Usage

### Prerequisites

- Node.js 20.19+ or 22.12+
- MongoDB Atlas or local MongoDB
- Firebase project
- Cloudinary account
- optional Google OAuth credentials for backend Passport routes

### Environment Files

Create:

- `client/.env` from `client/.env.example`
- `server/.env` from `server/.env.example`

Important notes:

- `server/.env` must contain a valid `MONGO_URI`, otherwise the backend exits on startup.
- the frontend mainly depends on Firebase client keys
- backend Google OAuth is optional and only active when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present

### Commands

```bash
npm install
npm run install:all
npm run dev
```

Default local URLs:

- frontend: `http://localhost:5173`
- backend: `http://localhost:5000`
- health check: `http://localhost:5000/health`

### How To Use The App

1. Open the frontend.
2. Sign up or log in.
3. Create a public, private, or team room from the dashboard.
4. Share the meeting ID or invite URL.
5. Open the room and allow camera and microphone access.
6. Use controls for mute, camera, screen share, raise hand, and leave.
7. Use the chat panel and participant list during the call.
8. Open Meeting History to view uploaded recordings.

### Where To Make Changes

| Goal | Best starting files |
| --- | --- |
| Change login or signup UX | `client/src/pages/Login.jsx`, `client/src/pages/Signup.jsx`, `client/src/store/authStore.js` |
| Replace or simplify auth strategy | `client/src/store/authStore.js`, `server/middleware/authMiddleware.js`, `server/controllers/authController.js`, `server/routes/authRoutes.js` |
| Change dashboard room creation or room cards | `client/src/pages/Dashboard.jsx`, `server/controllers/roomController.js`, `server/models/Room.js` |
| Change live meeting layout or controls | `client/src/pages/Room.jsx`, `client/src/components/VideoPlayer.jsx`, `client/src/components/ParticipantList.jsx`, `client/src/components/ChatBox.jsx` |
| Change socket behavior | `server/socket/socketHandler.js`, `client/src/services/socket.js` |
| Change WebRTC settings or add TURN | `client/src/services/webrtc.js` |
| Change recording behavior | `client/src/pages/Room.jsx`, `server/controllers/meetingController.js`, `server/config/cloudinary.js` |
| Change persisted data model | `server/models/*.js`, related controllers |
| Change shared styling | `client/src/index.css` |

### Important Current Characteristics

- `Room.jsx` is the largest orchestration file in the frontend and currently owns a lot of meeting logic.
- room presence is stored in an in-memory `activeRooms` map in `server/socket/socketHandler.js`
- WebRTC currently uses public STUN servers only
- recording is host-browser-based, not server-side
- chat history is persisted, but only the latest 100 messages are loaded when opening a room
- the app stores meeting participants in both room and meeting documents
