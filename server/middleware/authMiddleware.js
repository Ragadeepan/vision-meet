const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyFirebaseToken } = require("../config/firebaseAdmin");

const findOrCreateFirebaseUser = async (decodedToken) => {
  const email = decodedToken.email?.toLowerCase();
  if (!email) {
    return null;
  }

  const name = decodedToken.name || decodedToken.email?.split("@")[0] || "Vision User";
  const googleId = decodedToken.firebase?.identities?.["google.com"]?.[0];

  let user = await User.findOne({
    $or: [{ firebaseUid: decodedToken.uid }, { email }]
  });

  if (!user) {
    user = await User.create({
      name,
      email,
      firebaseUid: decodedToken.uid,
      googleId
    });
    return user;
  }

  let changed = false;
  if (!user.firebaseUid) {
    user.firebaseUid = decodedToken.uid;
    changed = true;
  }
  if (googleId && !user.googleId) {
    user.googleId = googleId;
    changed = true;
  }
  if (decodedToken.name && user.name !== decodedToken.name) {
    user.name = decodedToken.name;
    changed = true;
  }

  return changed ? user.save() : user;
};

const authenticateToken = async (token) => {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return User.findById(decoded.id);
  } catch (_jwtError) {
    const decodedFirebaseToken = await verifyFirebaseToken(token);
    if (!decodedFirebaseToken) {
      return null;
    }
    return findOrCreateFirebaseUser(decodedFirebaseToken);
  }
};

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication token missing." });
    }

    const user = await authenticateToken(token);

    if (!user) {
      return res.status(401).json({ message: "Authenticated user no longer exists." });
    }

    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired authentication token." });
  }
};

module.exports = { protect, authenticateToken };
