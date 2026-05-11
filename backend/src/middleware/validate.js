const AppError = require('../utils/AppError');

/**
 * Returns Express middleware that validates req.body against a Joi schema.
 */
function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const msg = error.details.map(d => d.message).join('; ');
      return next(new AppError(msg, 422));
    }
    req.body = value;
    next();
  };
}

module.exports = validate;
