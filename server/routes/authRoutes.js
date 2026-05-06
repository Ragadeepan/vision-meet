const express = require("express");
const passport = require("passport");
const { signup, login, googleCallback, me, syncFirebaseUser } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const googleAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", protect, me);
router.post("/firebase/sync", protect, syncFirebaseUser);

if (googleAuthConfigured) {
  router.get(
    "/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false
    })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=google-auth-failed`
    }),
    googleCallback
  );
} else {
  const googleAuthUnavailable = (_req, res) => {
    res.status(503).json({ message: "Google OAuth is not configured on this server." });
  };

  router.get("/google", googleAuthUnavailable);
  router.get("/google/callback", googleAuthUnavailable);
}

module.exports = router;
