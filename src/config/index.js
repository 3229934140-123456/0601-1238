require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'creative_design_platform_secret_key_2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  upload: {
    dir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
    maxSize: 50 * 1024 * 1024
  },
  database: {
    path: path.resolve(process.env.DB_PATH || './database.sqlite')
  }
};
