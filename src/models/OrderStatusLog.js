const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderStatusLog = sequelize.define('OrderStatusLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'order_id'
  },
  fromStatus: {
    type: DataTypes.STRING(30),
    field: 'from_status'
  },
  toStatus: {
    type: DataTypes.STRING(30),
    field: 'to_status'
  },
  remark: {
    type: DataTypes.STRING(500)
  },
  operatorId: {
    type: DataTypes.INTEGER,
    field: 'operator_id'
  },
  operatorType: {
    type: DataTypes.ENUM('customer', 'staff', 'system'),
    defaultValue: 'staff',
    field: 'operator_type'
  },
  operatorName: {
    type: DataTypes.STRING(50),
    field: 'operator_name'
  }
}, {
  tableName: 'order_status_logs',
  updatedAt: false
});

module.exports = OrderStatusLog;
