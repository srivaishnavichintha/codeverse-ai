const mongoose = require('mongoose');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');

class CreditService {
  /**
   * Get current credit balance for a user.
   */
  static async getBalance(userId) {
    const user = await User.findById(userId).select('credits').lean();
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
    return user.credits ?? 0;
  }

  /**
   * Debit credits from user. Uses a MongoDB session for atomicity.
   */
  static async debitCredits(userId, amount, reason, sessionId = null, idempotencyKey = undefined) {
    // Idempotency
    if (idempotencyKey) {
      const existing = await CreditTransaction.findOne({ idempotencyKey });
      if (existing) return existing;
    }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      const user = await User.findById(userId).session(mongoSession);
      if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });

      const balance = user.credits ?? 0;
      if (balance < amount) {
        throw Object.assign(
          new Error(`Insufficient credits. Required: ${amount}, Available: ${balance}`),
          { statusCode: 402 }
        );
      }

      const balanceAfter = balance - amount;
      user.credits = balanceAfter;
      await user.save({ session: mongoSession });

      const [tx] = await CreditTransaction.create(
        [
          {
            user: userId,
            type: 'debit',
            amount,
            balanceBefore: balance,
            balanceAfter,
            reason,
            session: sessionId || undefined,
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();
      return tx;
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  /**
   * Credit / refund credits to user.
   */
  static async refundCredits(userId, amount, sessionId = null, idempotencyKey = undefined) {
    if (idempotencyKey) {
      const existing = await CreditTransaction.findOne({ idempotencyKey });
      if (existing) return existing;
    }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      const user = await User.findById(userId).session(mongoSession);
      if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });

      const balance = user.credits ?? 0;
      const balanceAfter = balance + amount;
      user.credits = balanceAfter;
      await user.save({ session: mongoSession });

      const [tx] = await CreditTransaction.create(
        [
          {
            user: userId,
            type: 'refund',
            amount,
            balanceBefore: balance,
            balanceAfter,
            reason: 'interview_refund',
            session: sessionId || undefined,
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();
      return tx;
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  /**
   * Admin grant credits.
   */
  static async grantCredits(userId, amount, reason = 'admin_grant', metadata = {}) {
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      const user = await User.findById(userId).session(mongoSession);
      if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });

      const balance = user.credits ?? 0;
      const balanceAfter = balance + amount;
      user.credits = balanceAfter;
      await user.save({ session: mongoSession });

      const [tx] = await CreditTransaction.create(
        [
          {
            user: userId,
            type: 'credit',
            amount,
            balanceBefore: balance,
            balanceAfter,
            reason,
            metadata,
          },
        ],
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();
      return tx;
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  /**
   * Get transaction history for a user.
   */
  static async getTransactionHistory(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      CreditTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CreditTransaction.countDocuments({ user: userId }),
    ]);
    return { transactions, total, page, limit };
  }
}

module.exports = CreditService;
