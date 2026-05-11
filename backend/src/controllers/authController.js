'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'username, email, and password are required',
      });
    }

    const user = await User.create({
      username,
      email,
      password,
      displayName: displayName || username,
    });

    const token = signToken(user._id);
    user.password = undefined;

    return res.status(201).json({ success: true, token, data: { user } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email or username already in use',
      });
    }
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email and password are required',
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastSeenAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    user.password = undefined;

    return res.json({ success: true, token, data: { user } });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me  — return full user object, not just req.user stub
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};
