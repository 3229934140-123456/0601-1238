const { Sequelize } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.database.path,
  logging: config.env === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true
  }
});

module.exports = sequelize;
