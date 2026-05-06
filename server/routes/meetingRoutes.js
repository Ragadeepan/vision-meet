const express = require("express");
const multer = require("multer");
const {
  startMeeting,
  endMeeting,
  uploadRecording,
  getMeetingHistory
} = require("../controllers/meetingController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 }
});

router.use(protect);

router.get("/history", getMeetingHistory);
router.post("/:roomId/start", startMeeting);
router.patch("/:meetingId/end", endMeeting);
router.post("/:meetingId/recording", upload.single("recording"), uploadRecording);

module.exports = router;
