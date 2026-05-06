const mongoose = require("mongoose");
const Meeting = require("../models/Meeting");
const Message = require("../models/Message");
const Room = require("../models/Room");
const { authenticateToken } = require("../middleware/authMiddleware");

const activeRooms = new Map();

const getRoomKey = (room) => room.meetingId;

const findRoomByIdentifier = (identifier) => {
  const normalizedIdentifier = String(identifier || "").toUpperCase();
  const query = mongoose.Types.ObjectId.isValid(identifier)
    ? { $or: [{ _id: identifier }, { meetingId: normalizedIdentifier }] }
    : { meetingId: normalizedIdentifier };

  return Room.findOne(query).populate("hostId", "name email").populate("participants", "name email");
};

const serializeUser = (user) => ({
  _id: user._id?.toString(),
  name: user.name,
  email: user.email
});

const emitParticipants = (io, meetingId) => {
  const users = activeRooms.get(meetingId);
  if (users) {
    io.to(meetingId).emit("participants-updated", Array.from(users.values()));
  }
};

const configureSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication token missing."));
      }

      const user = await authenticateToken(token);

      if (!user) {
        return next(new Error("Authenticated user not found."));
      }

      socket.user = user;
      socket.joinedRooms = new Set();
      return next();
    } catch (_error) {
      return next(new Error("Socket authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    const leaveRoom = async (meetingId) => {
      const users = activeRooms.get(meetingId);

      if (users) {
        users.delete(socket.id);
        if (users.size === 0) {
          activeRooms.delete(meetingId);
        } else {
          socket.to(meetingId).emit("user-disconnected", {
            socketId: socket.id,
            userId: socket.user._id.toString()
          });
          io.to(meetingId).emit("participants-updated", Array.from(users.values()));
        }
      }

      socket.leave(meetingId);
      socket.joinedRooms?.delete(meetingId);
    };

    socket.on("join-room", async ({ roomId }, callback) => {
      try {
        const room = await findRoomByIdentifier(roomId);

        if (!room) {
          callback?.({ ok: false, message: "Room not found." });
          return;
        }

        const meetingId = getRoomKey(room);
        const isParticipant = room.participants.some((participant) => participant._id.equals(socket.user._id));

        if (room.type === "private" && !isParticipant) {
          callback?.({ ok: false, message: "Join this private room with its password before connecting." });
          return;
        }

        if (!isParticipant) {
          room.participants.push(socket.user._id);
          await room.save();
        }

        let meeting = await Meeting.findOne({ roomId: room._id, endTime: null });
        if (!meeting) {
          meeting = await Meeting.create({
            roomId: room._id,
            createdBy: room.hostId._id || room.hostId,
            participants: [socket.user._id]
          });
        } else if (!meeting.participants.some((participant) => participant.equals(socket.user._id))) {
          meeting.participants.push(socket.user._id);
          await meeting.save();
        }

        const users = activeRooms.get(meetingId) || new Map();
        const participant = {
          socketId: socket.id,
          user: serializeUser(socket.user),
          role: room.hostId._id.equals(socket.user._id) ? "host" : "participant",
          isMuted: false,
          isVideoOff: false,
          raisedHand: false
        };
        const existingUsers = Array.from(users.values());

        users.set(socket.id, participant);
        activeRooms.set(meetingId, users);
        socket.join(meetingId);
        socket.joinedRooms.add(meetingId);

        socket.emit("existing-users", existingUsers);
        socket.to(meetingId).emit("user-connected", participant);
        io.to(meetingId).emit("participants-updated", Array.from(users.values()));

        callback?.({
          ok: true,
          room: {
            _id: room._id,
            meetingId: room.meetingId,
            name: room.name,
            type: room.type,
            hostId: room.hostId
          },
          meeting
        });
      } catch (_error) {
        callback?.({ ok: false, message: "Unable to join room." });
      }
    });

    socket.on("leave-room", async ({ roomId }) => {
      const room = await findRoomByIdentifier(roomId);
      if (room) {
        await leaveRoom(getRoomKey(room));
      }
    });

    socket.on("send-message", async ({ roomId, message }, callback) => {
      try {
        const cleanMessage = String(message || "").trim();
        if (!cleanMessage) {
          callback?.({ ok: false, message: "Message cannot be empty." });
          return;
        }

        const room = await findRoomByIdentifier(roomId);
        if (!room) {
          callback?.({ ok: false, message: "Room not found." });
          return;
        }

        const savedMessage = await Message.create({
          roomId: room._id,
          userId: socket.user._id,
          message: cleanMessage
        });

        const payload = {
          _id: savedMessage._id,
          roomId: room._id,
          userId: serializeUser(socket.user),
          message: savedMessage.message,
          timestamp: savedMessage.timestamp
        };

        io.to(getRoomKey(room)).emit("receive-message", payload);
        callback?.({ ok: true });
      } catch (_error) {
        callback?.({ ok: false, message: "Unable to send message." });
      }
    });

    socket.on("webrtc-signal", ({ roomId, to, signal }) => {
      socket.to(to).emit("webrtc-signal", {
        roomId,
        from: socket.id,
        user: serializeUser(socket.user),
        signal
      });
    });

    socket.on("emoji-reaction", async ({ roomId, emoji }) => {
      const room = await findRoomByIdentifier(roomId);
      if (room) {
        io.to(getRoomKey(room)).emit("emoji-reaction", {
          emoji,
          from: serializeUser(socket.user),
          socketId: socket.id
        });
      }
    });

    socket.on("raise-hand", async ({ roomId, raised }) => {
      const room = await findRoomByIdentifier(roomId);
      if (!room) {
        return;
      }

      const users = activeRooms.get(getRoomKey(room));
      const participant = users?.get(socket.id);
      if (participant) {
        participant.raisedHand = Boolean(raised);
        emitParticipants(io, getRoomKey(room));
      }
    });

    socket.on("media-state-changed", async ({ roomId, isMuted, isVideoOff }) => {
      const room = await findRoomByIdentifier(roomId);
      if (!room) {
        return;
      }

      const users = activeRooms.get(getRoomKey(room));
      const participant = users?.get(socket.id);
      if (participant) {
        participant.isMuted = Boolean(isMuted);
        participant.isVideoOff = Boolean(isVideoOff);
        emitParticipants(io, getRoomKey(room));
      }
    });

    socket.on("mute-all", async ({ roomId }) => {
      const room = await findRoomByIdentifier(roomId);
      if (!room || !room.hostId._id.equals(socket.user._id)) {
        return;
      }

      const meetingId = getRoomKey(room);
      const users = activeRooms.get(meetingId);
      users?.forEach((participant) => {
        if (participant.socketId !== socket.id) {
          participant.isMuted = true;
        }
      });

      socket.to(meetingId).emit("host-muted-all", {
        by: serializeUser(socket.user)
      });
      emitParticipants(io, meetingId);
    });

    socket.on("remove-user", async ({ roomId, socketId }) => {
      const room = await findRoomByIdentifier(roomId);
      if (!room || !room.hostId._id.equals(socket.user._id)) {
        return;
      }

      io.to(socketId).emit("removed-from-room", {
        roomId: getRoomKey(room),
        by: serializeUser(socket.user)
      });
    });

    socket.on("disconnect", async () => {
      const rooms = Array.from(socket.joinedRooms || []);
      await Promise.all(rooms.map((meetingId) => leaveRoom(meetingId)));
    });
  });
};

module.exports = configureSocket;
