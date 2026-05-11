'use strict';

const potdService = require('../services/potd.service');

/**
 * GET /api/potd
 * Returns today's Problem of the Day.
 * Auto-creates one if it doesn't exist yet.
 * Public endpoint — no auth required.
 */
async function getTodayPOTD(req, res, next) {
  try {
    const { potd, problem, isNew } = await potdService.getTodayPOTD();

    return res.status(200).json({
      success: true,
      data: {
        date: potd.date,
        problem,
        selectionMethod: potd.selectionMethod,
        // Only show "fresh" flag to admin / debug — harmless to expose
        isNewlyGenerated: isNew,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/potd/history?days=7
 * Returns the last N days of POTD entries (default 7).
 * Public endpoint.
 */
async function getPOTDHistory(req, res, next) {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 7, 30); // cap at 30
    const history = await potdService.getPOTDHistory(days);

    return res.status(200).json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/potd/regenerate   (Admin only)
 * Force a new POTD for today.
 *
 * Body (all optional):
 *  { problemId: "<ObjectId>" }   — if provided, sets that specific problem
 *                                  otherwise auto-selects a new one
 */
async function regeneratePOTD(req, res, next) {
  try {
    const adminId = req.user.id;
    const { problemId } = req.body;

    const { potd, problem } = await potdService.regeneratePOTD(
      problemId || null,
      adminId
    );

    return res.status(200).json({
      success: true,
      message: 'POTD regenerated successfully.',
      data: {
        date: potd.date,
        problem,
        selectionMethod: potd.selectionMethod,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTodayPOTD,
  getPOTDHistory,
  regeneratePOTD,
};
