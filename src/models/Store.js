const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Store = sequelize.define('Store', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  storeNo: {
    type: DataTypes.STRING(32),
    unique: true,
    field: 'store_no'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  address: {
    type: DataTypes.STRING(255)
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  managerId: {
    type: DataTypes.INTEGER,
    field: 'manager_id'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'closed'),
    defaultValue: 'active'
  },
  type: {
    type: DataTypes.ENUM('reception', 'production', 'comprehensive'),
    defaultValue: 'comprehensive'
  },
  businessHours: {
    type: DataTypes.STRING(100),
    field: 'business_hours'
  },
  description: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'stores'
});

module.exports = Store;
