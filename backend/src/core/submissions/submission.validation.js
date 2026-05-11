const Joi = require('joi');

const LANGUAGES = ['c','cpp','java','python','javascript','typescript',
                   'go','rust','kotlin','swift','ruby','scala'];
const VERDICTS  = ['accepted','wrong_answer','time_limit_exceeded',
                   'memory_limit_exceeded','runtime_error','compilation_error',
                   'presentation_error'];

const submit = Joi.object({
  problem_slug: Joi.string().required(),
  language:     Joi.string().valid(...LANGUAGES).required(),
  source_code:  Joi.string().min(1).max(65536).required(),
});

const updateVerdict = Joi.object({
  verdict:        Joi.string().valid(...VERDICTS).required(),
  runtime_ms:     Joi.number().integer().min(0).allow(null),
  memory_kb:      Joi.number().integer().min(0).allow(null),
  score:          Joi.number().min(0).max(100).default(0),
  error_message:  Joi.string().max(2000).allow('', null),
  judge_metadata: Joi.object().allow(null),
});

module.exports = { submit, updateVerdict };
