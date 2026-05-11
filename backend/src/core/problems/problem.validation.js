const Joi = require('joi');

const testCase = Joi.object({
  input:           Joi.string().required(),
  expected_output: Joi.string().required(),
  visibility:      Joi.string().valid('visible', 'hidden').default('hidden'),
  score_weight:    Joi.number().min(0).max(100).default(1.0),
});

const example = Joi.object({
  input:       Joi.string().required(),
  output:      Joi.string().required(),
  explanation: Joi.string().allow('', null),
});

const createProblem = Joi.object({
  title:            Joi.string().max(300).required(),
  description:      Joi.string().required(),
  difficulty:       Joi.string().valid('easy', 'medium', 'hard').required(),
  constraints:      Joi.string().allow('', null),
  hints:            Joi.array().items(Joi.string()).max(5),
  time_limit_ms:    Joi.number().integer().min(100).max(10000).default(2000),
  memory_limit_kb:  Joi.number().integer().min(16384).max(1048576).default(262144),
  tags:             Joi.array().items(Joi.string().max(60)).max(10),
  examples:         Joi.array().items(example).min(1).required(),
  test_cases:       Joi.array().items(testCase).min(1).required(),
});

const updateProblem = Joi.object({
  title:           Joi.string().max(300),
  description:     Joi.string(),
  difficulty:      Joi.string().valid('easy', 'medium', 'hard'),
  constraints:     Joi.string().allow('', null),
  hints:           Joi.array().items(Joi.string()).max(5),
  time_limit_ms:   Joi.number().integer().min(100).max(10000),
  memory_limit_kb: Joi.number().integer().min(16384).max(1048576),
  is_published:    Joi.boolean(),
  diff_summary:    Joi.string().max(500).allow('', null),
}).min(1);

module.exports = { createProblem, updateProblem };
