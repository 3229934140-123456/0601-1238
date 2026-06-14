const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaperSpec = sequelize.define('PaperSpec', {
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
  size: {
    type: DataTypes.STRING(50)
  },
  width: {
    type: DataTypes.DECIMAL(10, 2)
  },
  height: {
    type: DataTypes.DECIMAL(10, 2)
  },
  unit: {
    type: DataTypes.STRING(10),
    defaultValue: 'mm'
  },
  thickness: {
    type: DataTypes.STRING(30)
  },
  weight: {
    type: DataTypes.INTEGER
  },
  pricePerUnit: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'price_per_unit'
  },
  priceUnit: {
    type: DataTypes.STRING(20),
    defaultValue: 'sheet',
    field: 'price_unit'
  },
  color: {
    type: DataTypes.STRING(50)
  },
  material: {
    type: DataTypes.STRING(50)
  },
  description: {
    type: DataTypes.TEXT
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
  tableName: 'paper_specs'
});

module.exports = PaperSpec;
