# Vision Meeting API And Socket Reference

## Base URLs

- frontend dev URL: `http://localhost:5173`
- backend dev URL: `http://localhost:5000`
- REST base path: `http://localhost:5000/api`

## Authentication Rules

Protected endpoints expect:

```http
Authorization: Bearer <token>
```

The backend accepts either:

- a Firebase ID token
- a backend JWT created by `/api/auth/signup` or `/api/auth/login`

Socket.io authentication is sent during connection:

```js
io(apiBaseUrl, {
  transports: ["websocket"],
  auth: { token }
})
```

## Health Endpoint

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | API status check |

Successful response:

```json
{
  "status": "ok",
  "service": "Vision Meeting API"
}
```

## Auth Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | No | Legacy backend signup with password hashing and JWT response |
| `POST` | `/api/auth/login` | No | Legacy backend login with JWT response |
| `GET` | `/api/auth/me` | Yes | Return authenticated user |
| `POST` | `/api/auth/firebase/sync` | Yes | Sync MongoDB user profile from Firebase-backed session |
| `GET` | `/api/auth/google` | Optional | Backend Passport Google OAuth entrypoint |
| `GET` | `/api/auth/google/callback` | Optional | Backend Passport Google OAuth callback |

### Notes

- The current React UI mainly uses Firebase Auth plus `/api/auth/firebase/sync`.
- `/api/auth/signup` and `/api/auth/login` are available, but not used by the current pages.
- Backend Google OAuth only works when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured.

### `POST /api/auth/signup`

Request body:

```json
{
  "name": "User Name",
  "phone": "+14155552671",
  "email": "user@example.com",
  "password": "secret123",
  "confirmPassword": "secret123"
}
```

Validation rules:

- all fields required
- password minimum length 6
- phone must match international format regex

### `POST /api/auth/login`

Request body:

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

### `POST /api/auth/firebase/sync`

Request body:

```json
{
  "name": "Optional Updated Name",
  "phone": "+14155552671"
}
```

This endpoint updates the authenticated MongoDB user if the fields changed.

## Room Endpoints

All room endpoints are protected.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/rooms` | List rooms where the user is host or participant |
| `POST` | `/api/rooms` | Create a room |
| `GET` | `/api/rooms/:roomId` | Load room details and latest messages |
| `POST` | `/api/rooms/:roomId/join` | Join a room, validating password if needed |

### `POST /api/rooms`

Request body:

```json
{
  "name": "Instant Meeting",
  "type": "public",
  "password": ""
}
```

Rules:

- `type` must be `public`, `private`, or `team`
- private rooms require a password of at least 4 characters
- creator becomes the host
- creator is added to the initial participants list

### `GET /api/rooms/:roomId`

Behavior:

- `roomId` can be the MongoDB `_id` or the public `meetingId`
- returns room details and up to 100 messages sorted by `timestamp`
- private room access is denied if the authenticated user is not yet a participant

### `POST /api/rooms/:roomId/join`

Request body:

```json
{
  "password": "1234"
}
```

Behavior:

- validates private room password
- adds user to `room.participants` if not already present
- returns the populated room

## Meeting Endpoints

All meeting endpoints are protected.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/meetings/history` | Load meetings relevant to the current user |
| `POST` | `/api/meetings/:roomId/start` | Start or resume the active meeting for a room |
| `PATCH` | `/api/meetings/:meetingId/end` | End a meeting |
| `POST` | `/api/meetings/:meetingId/recording` | Upload a meeting recording |

### `POST /api/meetings/:roomId/start`

Behavior:

- room must exist
- private room users must already be participants
- finds an active meeting where `endTime` is `null`
- creates one if none exists
- adds the current user to `meeting.participants` if needed

### `PATCH /api/meetings/:meetingId/end`

Rules:

- only the room host or meeting creator can end the meeting
- sets `endTime` if not already set

### `POST /api/meetings/:meetingId/recording`

Upload details:

- multipart field name: `recording`
- server uses `multer.memoryStorage()`
- file size limit: 250 MB
- only the room host or meeting creator can upload
- uploaded to Cloudinary as `resource_type: "video"`

### `GET /api/meetings/history`

Returns meetings where the user is:

- the creator
- a participant
- or associated with the room as host or participant

Meetings are sorted by latest `startTime`.

## Socket Authentication

Every socket connection is authenticated in `server/socket/socketHandler.js`.

The server:

1. reads `socket.handshake.auth.token`
2. validates it using `authenticateToken`
3. attaches the user to `socket.user`
4. rejects the connection if auth fails

## Socket Event Reference

### Client To Server Events

| Event | Payload | Purpose |
| --- | --- | --- |
| `join-room` | `{ roomId }` | Join active room presence and start meeting participation |
| `leave-room` | `{ roomId }` | Leave the room presence set |
| `send-message` | `{ roomId, message }` | Persist and broadcast a chat message |
| `webrtc-signal` | `{ roomId, to, signal }` | Send WebRTC offer, answer, or ICE candidate to a target socket |
| `emoji-reaction` | `{ roomId, emoji }` | Broadcast quick reaction |
| `raise-hand` | `{ roomId, raised }` | Update participant raised-hand state |
| `media-state-changed` | `{ roomId, isMuted, isVideoOff }` | Update participant media state |
| `mute-all` | `{ roomId }` | Host-only action to mute all others |
| `remove-user` | `{ roomId, socketId }` | Host-only action to remove a participant |

### `join-room` callback response

Success:

```json
{
  "ok": true,
  "room": {
    "_id": "room-id",
    "meetingId": "A1B2C3D4",
    "name": "Instant Meeting",
    "type": "public",
    "hostId": {
      "_id": "user-id",
      "name": "Host Name",
      "email": "host@example.com"
    }
  },
  "meeting": {
    "_id": "meeting-id"
  }
}
```

Failure:

```json
{
  "ok": false,
  "message": "Room not found."
}
```

### Server To Client Events

| Event | Payload | Purpose |
| --- | --- | --- |
| `existing-users` | `participant[]` | Existing participants already in the room |
| `user-connected` | `participant` | Notify others when a user joins |
| `participants-updated` | `participant[]` | Full participant state update |
| `user-disconnected` | `{ socketId, userId }` | Notify room when a socket leaves |
| `receive-message` | saved message payload | Broadcast persisted chat message |
| `webrtc-signal` | `{ roomId, from, user, signal }` | Deliver signaling payload |
| `emoji-reaction` | `{ emoji, from, socketId }` | Broadcast reaction |
| `host-muted-all` | `{ by }` | Tell clients the host muted everyone |
| `removed-from-room` | `{ roomId, by }` | Tell a client they were removed by host |

### Participant Object Shape

The in-memory participant entries stored in `activeRooms` look like:

```json
{
  "socketId": "socket-id",
  "user": {
    "_id": "user-id",
    "name": "User Name",
    "email": "user@example.com"
  },
  "role": "host",
  "isMuted": false,
  "isVideoOff": false,
  "raisedHand": false
}
```

## MongoDB Models

### `User`

Key fields:

- `name`
- `email`
- `phone`
- `password`
- `googleId`
- `firebaseUid`

Behavior:

- hashes password before save
- hides password in JSON output

### `Room`

Key fields:

- `meetingId`
- `name`
- `hostId`
- `type`
- `password`
- `participants`

Behavior:

- auto-generates `meetingId`
- hashes private room password before save

### `Meeting`

Key fields:

- `roomId`
- `createdBy`
- `startTime`
- `endTime`
- `recordingUrl`
- `participants`

### `Message`

Key fields:

- `roomId`
- `userId`
- `message`
- `timestamp`

### Current Operational Constraints

- active room presence exists only in process memory
- restarting the server clears current socket presence
- Socket.io is not using Redis or another distributed adapter
- recordings are uploaded from the host browser, not generated server-side
- WebRTC is using public STUN only, with no TURN fallback configured yet
