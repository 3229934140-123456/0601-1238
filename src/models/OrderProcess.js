const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderProcess = sequelize.define('OrderProcess', {
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
  processKey: {
    type: DataTypes.ENUM('proofing', 'printing', 'postpress', 'quality', 'packing'),
    allowNull: false,
    field: 'process_key'
  },
  processName: {
    type: DataTypes.STRING(50),
    field: 'process_name'
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'skipped', 'exception', 'rework'),
    defaultValue: 'pending'
  },
  startedAt: {
    type: DataTypes.DATE,
    field: 'started_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    field: 'completed_at'
  },
  operatorId: {
    type: DataTypes.INTEGER,
    field: 'operator_id'
  },
  operatorName: {
    type: DataTypes.STRING(50),
    field: 'operator_name'
  },
  remark: {
    type: DataTypes.STRING(500)
  },
  exceptionReason: {
    type: DataTypes.STRING(500),
    field: 'exception_reason'
  },
  reworkCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'rework_count'
  },
  reworkReason: {
    type: DataTypes.STRING(500),
    field: 'rework_reason'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'order_processes',
  indexes: [
    { fields: ['order_id'] },
    { fields: ['order_id', 'process_key'], unique: true }
  ]
});

module.exports = OrderProcess;
