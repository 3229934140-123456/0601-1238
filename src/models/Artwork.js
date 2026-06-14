const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Artwork = sequelize.define('Artwork', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  artworkNo: {
    type: DataTypes.STRING(32),
    unique: true,
    field: 'artwork_no'
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.STRING(50)
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'reviewing', 'revision', 'approved', 'rejected', 'completed'),
    defaultValue: 'draft'
  },
  currentVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    field: 'current_version'
  },
  tags: {
    type: DataTypes.STRING(500)
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by'
  }
}, {
  tableName: 'artworks'
});

module.exports = Artwork;
