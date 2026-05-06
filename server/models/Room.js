const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: {
      type: String,
      enum: ["public", "private", "team"],
      default: "public"
    },
    password: {
      type: String,
      select: false
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

roomSchema.pre("validate", function assignMeetingId(next) {
  if (!this.meetingId) {
    this.meetingId = crypto.randomBytes(4).toString("hex").toUpperCase();
  }
  next();
});

roomSchema.pre("save", async function hashRoomPassword(next) {
  if (!this.isModified("password") || !this.password) {
    next();
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

roomSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  if (!this.password) {
    return true;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Room", roomSchema);
