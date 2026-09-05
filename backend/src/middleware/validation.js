const { body, query, validationResult } = require("express-validator");

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateChat = [
  body("message").isString().trim().isLength({ min: 1, max: 2000 }),
  body("session_id").optional().isString(),
  handleValidation,
];

const validateForecast = [
  query("date").isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  handleValidation,
];

const validateDailyWeather = [
  body("date").isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body("temp_mean").isNumeric(),
  body("temp_max").isNumeric(),
  body("temp_min").isNumeric(),
  body("cloud_cover_mean").isNumeric(),
  body("humidity_mean").isNumeric(),
  body("ghi_sum").isNumeric(),
  body("dni_sum").isNumeric(),
  body("diffuse_sum").isNumeric(),
  body("precipitation_sum").isNumeric(),
  handleValidation,
];

const validateAuth = [
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  handleValidation,
];

module.exports = {
  validateChat,
  validateForecast,
  validateDailyWeather,
  validateAuth,
  handleValidation,
};
