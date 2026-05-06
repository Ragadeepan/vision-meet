const Meeting = require("../models/Meeting");
const Room = require("../models/Room");
const { uploadBufferToCloudinary } = require("../config/cloudinary");
const { findRoomByIdentifier } = require("./roomController");

const startMeeting = async (req, res, next) => {
  try {
    const room = await findRoomByIdentifier(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    const isParticipant = room.participants.some((participant) => participant._id.equals(req.user._id));
    if (room.type === "private" && !isParticipant) {
      return res.status(403).json({ message: "Join this private room with its password before starting media." });
    }

    let meeting = await Meeting.findOne({ roomId: room._id, endTime: null });

    if (!meeting) {
      meeting = await Meeting.create({
        roomId: room._id,
        createdBy: room.hostId._id || room.hostId,
        participants: [req.user._id]
      });
    } else if (!meeting.participants.some((participant) => participant.equals(req.user._id))) {
      meeting.participants.push(req.user._id);
      await meeting.save();
    }

    await meeting.populate([
      { path: "roomId", select: "name meetingId type hostId" },
      { path: "participants", select: "name email" }
    ]);

    res.json({ meeting });
  } catch (error) {
    next(error);
  }
};

const endMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.meetingId).populate("roomId", "hostId");

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const isHost = meeting.roomId.hostId.equals(req.user._id);
    const isCreator = meeting.createdBy.equals(req.user._id);

    if (!isHost && !isCreator) {
      return res.status(403).json({ message: "Only the host can end this meeting." });
    }

    meeting.endTime = meeting.endTime || new Date();
    await meeting.save();

    res.json({ meeting });
  } catch (error) {
    next(error);
  }
};

const uploadRecording = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Recording file is required." });
    }

    const meeting = await Meeting.findById(req.params.meetingId).populate("roomId", "hostId meetingId");

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const isHost = meeting.roomId.hostId.equals(req.user._id);
    const isCreator = meeting.createdBy.equals(req.user._id);

    if (!isHost && !isCreator) {
      return res.status(403).json({ message: "Only the host can upload the meeting recording." });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      public_id: `${meeting.roomId.meetingId}-${meeting._id}-${Date.now()}`
    });

    meeting.recordingUrl = uploadResult.secure_url;
    meeting.endTime = meeting.endTime || new Date();
    await meeting.save();

    res.json({ meeting, recordingUrl: meeting.recordingUrl });
  } catch (error) {
    next(error);
  }
};

const getMeetingHistory = async (req, res, next) => {
  try {
    const rooms = await Room.find({
      $or: [{ hostId: req.user._id }, { participants: req.user._id }]
    }).select("_id");

    const roomIds = rooms.map((room) => room._id);

    const meetings = await Meeting.find({
      $or: [{ createdBy: req.user._id }, { participants: req.user._id }, { roomId: { $in: roomIds } }]
    })
      .sort({ startTime: -1 })
      .populate("roomId", "name meetingId type")
      .populate("createdBy", "name email")
      .populate("participants", "name email");

    res.json({ meetings });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startMeeting,
  endMeeting,
  uploadRecording,
  getMeetingHistory
};
