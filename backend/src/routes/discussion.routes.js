const { Router } = require('express');
const ctrl = require('../core/discussions/discussion.controller');
const schemas = require('../core/discussions/discussion.validation');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

// Global discussions feed
router.get('/', ctrl.getAllDiscussions);

// Problem discussions
router.get(
  '/problem/:problemId',
  ctrl.getDiscussions
);

router.post(
  '/problem/:problemId',
  authenticate,
  validate(schemas.createDiscussion),
  ctrl.createDiscussion
);

// Single discussion
router.get('/:discussionId', ctrl.getDiscussion);

// Comments
router.get(
  '/:id/comments',
  ctrl.getComments
);

router.post(
  '/:id/comments',
  authenticate,
  validate(schemas.createComment),
  ctrl.addComment
);

// Vote
router.post(
  '/:id/vote',
  authenticate,
  ctrl.voteDiscussion
);

module.exports = router;