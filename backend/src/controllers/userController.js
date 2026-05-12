'use strict';

const User       = require('../models/User');
const Submission = require('../models/Submission');

// GET /api/users/:username — public profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -activity')
      .lean();

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Compute accuracy from stored stats — model stores totalSubmissions but not acceptedSubmissions
    // Use stats.totalSolved as a proxy for accepted submissions
    const { totalSubmissions = 0, totalSolved = 0 } = user.stats || {};
    user.accuracy = totalSubmissions
      ? parseFloat(((totalSolved / totalSubmissions) * 100).toFixed(2))
      : 0;

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:username/activity — heatmap data
exports.getActivity = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('activity username').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { activity: user.activity || [] } });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:username/submissions  (protected — own submissions or admin)
exports.getSubmissions = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('_id').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const page  = parseInt(req.query.page)  || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      Submission.find({ user: user._id })
        .populate({ path: 'problem', select: 'title slug difficulty' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-code -testResults')
        .lean(),
      Submission.countDocuments({ user: user._id }),
    ]);

    res.json({
      success: true,
      data: {
        docs:  submissions,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/leaderboard
exports.getLeaderboard = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.country) filter.country = req.query.country;

    // Rating-band filter — used by matchmaking "players near you" discovery
    const ratingMin = parseInt(req.query.ratingMin, 10);
    const ratingMax = parseInt(req.query.ratingMax, 10);
    if (!isNaN(ratingMin) || !isNaN(ratingMax)) {
      filter.rating = {};
      if (!isNaN(ratingMin)) filter.rating.$gte = ratingMin;
      if (!isNaN(ratingMax)) filter.rating.$lte = ratingMax;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('username displayName avatar rating stats.totalSolved country level streak contestWins contestsParticipated wins losses stats.totalSubmissions')
        .sort({ rating: -1, wins: -1, username: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    users.forEach((u, i) => { u.rank = skip + i + 1; });

    res.json({
      success: true,
      data: { users, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/me — update own profile
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['displayName', 'bio', 'country', 'github', 'linkedin', 'website', 'avatar'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    // req.user.id is set by protect middleware (string)
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true, runValidators: true,
    }).select('-password');

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/me/stats  — problem stats for logged-in user (used by frontend)
exports.getMyStats = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('stats username level streak contestWins contestsParticipated rating ratingHistory')
      .lean();

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Recent submissions for activity feed
    const recentSubmissions = await Submission.find({ user: req.user.id })
      .populate({ path: 'problem', select: 'title slug difficulty' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-code -testResults')
      .lean();

    // Calculate Global Rank
    const userRating = user.rating || 0;
    const userWins = user.wins || 0;
    
    const globalRank = await User.countDocuments({
      $or: [
        { rating: { $gt: userRating } },
        { rating: userRating, wins: { $gt: userWins } },
        { rating: userRating, wins: userWins, username: { $lt: user.username } }
      ]
    }) + 1;

    res.json({
      success: true,
      data: {
        solved: {
          easy:   user.stats?.easySolved   || 0,
          medium: user.stats?.mediumSolved  || 0,
          hard:   user.stats?.hardSolved    || 0,
          total:  user.stats?.totalSolved   || 0,
        },
        weekly: {
          solved:             0,  // would need a real weekly counter
          target:             14,
          accuracy:           0,
          runtimePercentile:  0,
        },
        peerStats: {
          level: user.level || 1,
          streak: user.streak || 0,
          contestWins: user.contestWins || 0,
          contestsParticipated: user.contestsParticipated || 0,
          globalRank,
          ratingHistory: user.ratingHistory || [],
        },
        recentSubmissions,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getFullProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};