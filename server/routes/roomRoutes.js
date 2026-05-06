const express = require("express");
const { createRoom, getRoom, joinRoom, listMyRooms } = require("../controllers/roomController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.route("/").get(listMyRooms).post(createRoom);
router.get("/:roomId", getRoom);
router.post("/:roomId/join", joinRoom);

module.exports = router;
