'use strict';

const CreditService = require('../services/CreditService');

/**
 * GET /api/credits/balance
 * Get the current user's credit balance.
 */
async function getBalance(req, res) {
  const userId = req.user._id || req.user.id;
  const balance = await CreditService.getBalance(userId);

  return res.status(200).json({
    success: true,
    data: { balance },
  });
}

/**
 * GET /api/credits/transactions
 * Get paginated credit transaction history for the current user.
 * Query: ?page=1&limit=20
 */
async function getTransactions(req, res) {
  const userId = req.user._id || req.user.id;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));

  const result = await CreditService.getTransactionHistory(userId, page, limit);

  return res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * POST /api/credits/grant  (Admin only)
 * Grant credits to a user.
 * Body: { userId, amount, reason }
 */
async function grantCredits(req, res) {
  const { userId, amount, reason, metadata } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'userId and a positive amount are required.',
    });
  }

  const transaction = await CreditService.grantCredits(
    userId,
    amount,
    reason || 'admin_grant',
    metadata || {}
  );

  return res.status(201).json({
    success: true,
    message: `Granted ${amount} credits.`,
    data: transaction,
  });
}

/**
 * POST /api/credits/deduct  (Admin only)
 * Manually debit credits from a user.
 * Body: { userId, amount, reason }
 */
async function deductCredits(req, res) {
  const { userId, amount, reason } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'userId and a positive amount are required.',
    });
  }

  const idempotencyKey = req.headers['x-idempotency-key'] || undefined;
  const transaction = await CreditService.debitCredits(
    userId,
    amount,
    reason || 'other',
    null,
    idempotencyKey
  );

  return res.status(201).json({
    success: true,
    message: `Deducted ${amount} credits.`,
    data: transaction,
  });
}

module.exports = {
  getBalance,
  getTransactions,
  grantCredits,
  deductCredits,
};
