const Joi = require('joi');

const register = Joi.object({
  username:     Joi.string().alphanum().min(3).max(50).required(),
  email:        Joi.string().email().required(),
  password:     Joi.string().min(8).max(128).required(),
  display_name: Joi.string().max(100).optional(),
});

const login = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateProfile = Joi.object({
  display_name: Joi.string().max(100),
  bio:          Joi.string().max(500),
  country:      Joi.string().max(100),
  github_url:   Joi.string().uri().max(255).allow('', null),
  linkedin_url: Joi.string().uri().max(255).allow('', null),
  website_url:  Joi.string().uri().max(255).allow('', null),
  avatar_url:   Joi.string().uri().max(500).allow('', null),
});

const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = { register, login, updateProfile, refreshToken };
