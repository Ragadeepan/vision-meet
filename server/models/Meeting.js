const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    recordingUrl: {
      type: String,
      default: ""
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: true }
);

meetingSchema.index({ roomId: 1, endTime: 1 });
meetingSchema.index({ createdBy: 1, startTime: -1 });

module.exports = mongoose.model("Meeting", meetingSchema);
