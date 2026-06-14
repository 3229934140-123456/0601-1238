const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProcessSpec = sequelize.define('ProcessSpec', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50)
  },
  type: {
    type: DataTypes.ENUM('printing', 'postpress', 'special'),
    defaultValue: 'printing'
  },
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'base_price'
  },
  priceUnit: {
    type: DataTypes.STRING(20),
    defaultValue: 'item',
    field: 'price_unit'
  },
  unitType: {
    type: DataTypes.STRING(20),
    field: 'unit_type'
  },
  description: {
    type: DataTypes.TEXT
  },
  options: {
    type: DataTypes.JSON
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'process_specs'
});

module.exports = ProcessSpec;
