const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settlement = sequelize.define('Settlement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  settlementNo: {
    type: DataTypes.STRING(32),
    unique: true,
    field: 'settlement_no'
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id'
  },
  period: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  periodStart: {
    type: DataTypes.DATE,
    field: 'period_start'
  },
  periodEnd: {
    type: DataTypes.DATE,
    field: 'period_end'
  },
  orderCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'order_count'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_amount'
  },
  paidAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'paid_amount'
  },
  unpaidAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'unpaid_amount'
  },
  refundAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'refund_amount'
  },
  status: {
    type: DataTypes.ENUM('draft', 'confirmed', 'settled', 'disputed'),
    defaultValue: 'draft'
  },
  confirmedBy: {
    type: DataTypes.INTEGER,
    field: 'confirmed_by'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    field: 'confirmed_at'
  },
  customerConfirmedAt: {
    type: DataTypes.DATE,
    field: 'customer_confirmed_at'
  },
  remark: {
    type: DataTypes.TEXT
  },
  orderIds: {
    type: DataTypes.JSON,
    field: 'order_ids'
  }
}, {
  tableName: 'settlements'
});

module.exports = Settlement;
