# Vision Meeting

Vision Meeting is a full-stack video conferencing app built with React, Vite, Tailwind CSS, Zustand, React Router, Socket.io, WebRTC, Node.js, Express, JWT, Passport Google OAuth, MongoDB, and Cloudinary.

## Features

- Email/password signup and login with JWT
- Firebase Email/Password and Google login/signup
- Backend JWT login remains available as a fallback
- Protected dashboard, room, and meeting history routes
- Public/private/team rooms with optional room passwords
- Unique meeting IDs and shareable meeting links
- Real-time Socket.io room presence, chat, emoji reactions, raise hand, and host controls
- Multi-peer WebRTC video/audio calls with SDP and ICE exchange over Socket.io
- Audio mute/unmute, camera on/off, screen sharing, and participant list
- Host-side composite MediaRecorder recording with mixed meeting audio upload to Cloudinary
- Meeting history with recording playback/download links
- Responsive Tailwind UI with dark mode

## Prerequisites

- Node.js 20.19+ or 22.12+
- MongoDB Atlas database or local MongoDB
- Cloudinary account
- Firebase project with Email/Password and Google providers enabled
- Google OAuth credentials if you also want to keep Passport.js backend OAuth enabled

## Environment Variables

Create `server/.env` from `server/.env.example` and `client/.env` from `client/.env.example`.

```env
PORT=5000
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/vision-meeting
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
SESSION_SECRET=replace-with-another-long-random-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
FIREBASE_PROJECT_ID=visionmeet-75722
```

```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

Firebase Authentication uses the client-side SDK for Email/Password and Google popup sign-in. The server verifies Firebase ID tokens using `FIREBASE_PROJECT_ID` and automatically syncs the Firebase user into MongoDB.

If you also keep the Passport.js backend Google OAuth route, configure this Google OAuth callback URL:

```txt
http://localhost:5000/api/auth/google/callback
```

## Local Setup

```bash
npm install
npm run install:all
npm run dev
```

Client: `http://localhost:5173`

Server: `http://localhost:5000`

Important: the backend needs `server/.env` with a valid `MONGO_URI`. Without it, the frontend can start but the API server will exit during boot.

## Documentation

- [Project overview](docs/01-project-overview.md)
- [API and socket reference](docs/02-api-and-socket-reference.md)
- [Improvement guide](docs/03-improvement-guide.md)

## Deployment

- Frontend: deploy `client` to Vercel and set `VITE_API_URL` to the backend URL.
- Backend: deploy `server` to Render or Railway and set all server environment variables.
- Database: use MongoDB Atlas and put the connection string in `MONGO_URI`.
- Storage: use Cloudinary and set the Cloudinary credentials.

## Notes

- WebRTC requires HTTPS in production for camera, microphone, and screen sharing APIs.
- The browser recording flow uses MediaRecorder on the host, composites local and remote video into a canvas, mixes available meeting audio, and uploads when the host leaves.
- For TURN/NAT reliability in production, add TURN servers to `client/src/services/webrtc.js`.
