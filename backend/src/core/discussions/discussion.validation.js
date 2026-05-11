const Joi = require('joi');

const createDiscussion = Joi.object({
  title: Joi.string().min(5).max(300).required(),
  body:  Joi.string().min(10).required(),
  tags:  Joi.array().items(Joi.string()).optional(),
  category: Joi.string().valid('general', 'problem', 'interview', 'doubt').optional(),
});

const updateDiscussion = Joi.object({
  title: Joi.string().min(5).max(300),
  body:  Joi.string().min(10),
}).min(1);

const createComment = Joi.object({
  body:     Joi.string().min(1).max(5000).required(),
  parentId: Joi.string().uuid().allow(null).optional(),
});

const updateComment = Joi.object({
  body: Joi.string().min(1).max(5000).required(),
});

const vote = Joi.object({
  target_type: Joi.string().valid('discussion', 'comment').required(),
  target_id:   Joi.string().uuid().required(),
  value:       Joi.string().valid('upvote', 'downvote').required(),
});

module.exports = { createDiscussion, updateDiscussion, createComment, updateComment, vote };
