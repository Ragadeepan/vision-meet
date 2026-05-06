const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getPrimaryClientUrl } = require("../config/clientOrigins");

const phoneRegex = /^\+?[1-9]\d{7,14}$/;

const signToken = (user) =>
  jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

const sendAuthResponse = (res, user, status = 200) => {
  const token = signToken(user);
  return res.status(status).json({ token, user });
};

const signup = async (req, res, next) => {
  try {
    const { name, phone, email, password, confirmPassword } = req.body;

    if (!name || !phone || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All signup fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Enter a valid phone number with country code." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = await User.create({
      name,
      phone,
      email: email.toLowerCase(),
      password
    });

    return sendAuthResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return sendAuthResponse(res, user);
  } catch (error) {
    next(error);
  }
};

const googleCallback = (req, res) => {
  const token = signToken(req.user);
  const clientUrl = getPrimaryClientUrl();
  res.redirect(`${clientUrl}/auth/success?token=${token}`);
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

const syncFirebaseUser = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    let changed = false;

    if (name?.trim() && req.user.name !== name.trim()) {
      req.user.name = name.trim();
      changed = true;
    }

    if (phone?.trim() && req.user.phone !== phone.trim()) {
      req.user.phone = phone.trim();
      changed = true;
    }

    if (changed) {
      await req.user.save();
    }

    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  googleCallback,
  me,
  syncFirebaseUser,
  signToken
};
