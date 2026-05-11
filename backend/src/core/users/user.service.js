const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const userRepo = require('./user.repository');
const AppError = require('../../utils/AppError');

function signAccess(userId, role) {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function signRefresh(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class UserService {
  async register({ username, email, password, display_name }) {
    const exists = await userRepo.findByEmail(email);
    if (exists) throw new AppError('Email already registered', 409);

    const existsU = await userRepo.findByUsername(username);
    if (existsU) throw new AppError('Username already taken', 409);

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const password_hash = await bcrypt.hash(password, rounds);

    const user = await userRepo.create({ username, email, password_hash, display_name });
    return user;
  }

  async login({ email, password }) {
    const user = await userRepo.findByEmail(email);
    if (!user || !user.is_active) throw new AppError('Invalid credentials', 401);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new AppError('Invalid credentials', 401);

    const accessToken  = signAccess(user.id, user.role);
    const refreshToken = signRefresh(user.id);
    const hash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await userRepo.saveRefreshToken(user.id, hash, expiresAt);

    return { accessToken, refreshToken, user: { id: user.id, username: user.username, role: user.role } };
  }

  async refresh(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
    const hash  = hashToken(refreshToken);
    const saved = await userRepo.findRefreshToken(hash);
    if (!saved) throw new AppError('Refresh token revoked or expired', 401);

    await userRepo.revokeRefreshToken(hash);

    const newRefresh = signRefresh(payload.sub);
    const newHash    = hashToken(newRefresh);
    const expiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await userRepo.saveRefreshToken(payload.sub, newHash, expiresAt);

    const user = await userRepo.findById(payload.sub);
    const accessToken = signAccess(payload.sub, user.role);
    return { accessToken, refreshToken: newRefresh };
  }

  async logout(refreshToken) {
    const hash = hashToken(refreshToken);
    await userRepo.revokeRefreshToken(hash);
  }

  async getProfile(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async updateProfile(userId, fields) {
    const updated = await userRepo.updateProfile(userId, fields);
    if (!updated) throw new AppError('No valid fields to update', 400);
    return updated;
  }

  async getStats(userId) {
    const stats = await userRepo.getStats(userId);
    if (!stats) throw new AppError('User stats not found', 404);
    return stats;
  }

  async getSolvedProblems(userId, pagination) {
    return userRepo.getSolvedProblems(userId, pagination);
  }

  async getActivity(userId, days) {
    return userRepo.getActivity(userId, days);
  }

  async getLeaderboard(pagination) {
    return userRepo.getLeaderboard(pagination);
  }
}

module.exports = new UserService();
