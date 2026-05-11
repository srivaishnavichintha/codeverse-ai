const { Router } = require('express');
const ctrl    = require('../core/problems/problem.controller');
const schemas = require('../core/problems/problem.validation');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

// Public
router.get('/tags',                                            ctrl.getAllTags);
router.get('/',   ctrl.listProblems);   // auth optional (solved flag)
router.get('/:slug',    ctrl.getProblem);

// Admin only
router.post('/',
  authenticate, authorize('admin'),
  validate(schemas.createProblem),
  ctrl.createProblem
);

router.patch('/:problemId',
  authenticate, authorize('admin'),
  validate(schemas.updateProblem),
  ctrl.updateProblem
);

router.get('/:problemId/stats',
  authenticate, authorize('admin', 'moderator'),
  ctrl.getProblemStats
);

module.exports = router;
