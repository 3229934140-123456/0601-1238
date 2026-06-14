const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerNo: {
    type: DataTypes.STRING(32),
    unique: true,
    field: 'customer_no'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  contact: {
    type: DataTypes.STRING(50)
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  email: {
    type: DataTypes.STRING(100)
  },
  address: {
    type: DataTypes.STRING(255)
  },
  company: {
    type: DataTypes.STRING(100)
  },
  level: {
    type: DataTypes.ENUM('normal', 'silver', 'gold', 'diamond'),
    defaultValue: 'normal'
  },
  discountRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 100,
    field: 'discount_rate'
  },
  creditLimit: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'credit_limit'
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'blacklist'),
    defaultValue: 'active'
  },
  source: {
    type: DataTypes.STRING(50)
  },
  remark: {
    type: DataTypes.TEXT
  },
  salesUserId: {
    type: DataTypes.INTEGER,
    field: 'sales_user_id'
  },
  totalOrders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_orders'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_amount'
  }
}, {
  tableName: 'customers'
});

module.exports = Customer;
