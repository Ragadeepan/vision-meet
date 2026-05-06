const mongoose = require("mongoose");
const Room = require("../models/Room");
const Message = require("../models/Message");

const findRoomByIdentifier = async (identifier, includePassword = false) => {
  const normalizedIdentifier = String(identifier || "").toUpperCase();
  const query = mongoose.Types.ObjectId.isValid(identifier)
    ? { $or: [{ _id: identifier }, { meetingId: normalizedIdentifier }] }
    : { meetingId: normalizedIdentifier };

  const roomQuery = Room.findOne(query)
    .populate("hostId", "name email")
    .populate("participants", "name email");

  if (includePassword) {
    roomQuery.select("+password");
  }

  return roomQuery;
};

const createRoom = async (req, res, next) => {
  try {
    const { name, type = "public", password = "" } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Room name is required." });
    }

    if (!["public", "private", "team"].includes(type)) {
      return res.status(400).json({ message: "Room type must be public, private, or team." });
    }

    if (type === "private" && password.length < 4) {
      return res.status(400).json({ message: "Private room password must be at least 4 characters." });
    }

    const room = await Room.create({
      name: name.trim(),
      hostId: req.user._id,
      type,
      password: password || undefined,
      participants: [req.user._id]
    });

    const populatedRoom = await Room.findById(room._id)
      .populate("hostId", "name email")
      .populate("participants", "name email");

    res.status(201).json({ room: populatedRoom });
  } catch (error) {
    next(error);
  }
};

const getRoom = async (req, res, next) => {
  try {
    const room = await findRoomByIdentifier(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    const isParticipant = room.participants.some((participant) => participant._id.equals(req.user._id));
    if (room.type === "private" && !isParticipant) {
      return res.status(403).json({ message: "Private room access requires the room password." });
    }

    const messages = await Message.find({ roomId: room._id })
      .sort({ timestamp: 1 })
      .limit(100)
      .populate("userId", "name email");

    res.json({ room, messages });
  } catch (error) {
    next(error);
  }
};

const joinRoom = async (req, res, next) => {
  try {
    const { password = "" } = req.body;
    const room = await findRoomByIdentifier(req.params.roomId, true);

    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    if (room.password && !(await room.comparePassword(password))) {
      return res.status(403).json({ message: "Invalid room password." });
    }

    if (!room.participants.some((participant) => participant._id.equals(req.user._id))) {
      room.participants.push(req.user._id);
      await room.save();
    }

    const populatedRoom = await Room.findById(room._id)
      .populate("hostId", "name email")
      .populate("participants", "name email");

    res.json({ room: populatedRoom });
  } catch (error) {
    next(error);
  }
};

const listMyRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({
      $or: [{ hostId: req.user._id }, { participants: req.user._id }]
    })
      .sort({ createdAt: -1 })
      .populate("hostId", "name email")
      .populate("participants", "name email");

    res.json({ rooms });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  listMyRooms,
  findRoomByIdentifier
};
