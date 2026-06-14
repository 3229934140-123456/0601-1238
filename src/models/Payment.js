const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  paymentNo: {
    type: DataTypes.STRING(32),
    unique: true,
    field: 'payment_no'
  },
  orderId: {
    type: DataTypes.INTEGER,
    field: 'order_id'
  },
  customerId: {
    type: DataTypes.INTEGER,
    field: 'customer_id'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'alipay', 'wechat', 'credit', 'other'),
    defaultValue: 'bank_transfer',
    field: 'payment_method'
  },
  transactionNo: {
    type: DataTypes.STRING(100),
    field: 'transaction_no'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'refunded'),
    defaultValue: 'pending'
  },
  confirmedBy: {
    type: DataTypes.INTEGER,
    field: 'confirmed_by'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    field: 'confirmed_at'
  },
  remark: {
    type: DataTypes.STRING(500)
  },
  receiptImage: {
    type: DataTypes.STRING(500),
    field: 'receipt_image'
  }
}, {
  tableName: 'payments'
});

module.exports = Payment;
