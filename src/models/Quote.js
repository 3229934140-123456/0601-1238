const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Quote = sequelize.define('Quote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  quoteNo: {
    type: DataTypes.STRING(32),
    unique: true,
    field: 'quote_no'
  },
  customerId: {
    type: DataTypes.INTEGER,
    field: 'customer_id'
  },
  artworkId: {
    type: DataTypes.INTEGER,
    field: 'artwork_id'
  },
  title: {
    type: DataTypes.STRING(200)
  },
  paperSpecId: {
    type: DataTypes.INTEGER,
    field: 'paper_spec_id'
  },
  paperSpecDetail: {
    type: DataTypes.JSON,
    field: 'paper_spec_detail'
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  size: {
    type: DataTypes.STRING(50)
  },
  processList: {
    type: DataTypes.JSON,
    field: 'process_list'
  },
  basePrice: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'base_price'
  },
  paperPrice: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'paper_price'
  },
  processPrice: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'process_price'
  },
  otherPrice: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'other_price'
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  totalPrice: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_price'
  },
  manualAdjustment: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'manual_adjustment'
  },
  adjustedBy: {
    type: DataTypes.INTEGER,
    field: 'adjusted_by'
  },
  adjustRemark: {
    type: DataTypes.STRING(500),
    field: 'adjust_remark'
  },
  days: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'confirmed', 'rejected', 'expired'),
    defaultValue: 'draft'
  },
  validDays: {
    type: DataTypes.INTEGER,
    defaultValue: 7,
    field: 'valid_days'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    field: 'confirmed_at'
  },
  expiredAt: {
    type: DataTypes.DATE,
    field: 'expired_at'
  },
  remark: {
    type: DataTypes.TEXT
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by'
  },
  creatorType: {
    type: DataTypes.ENUM('customer', 'staff', 'system'),
    defaultValue: 'system',
    field: 'creator_type'
  }
}, {
  tableName: 'quotes'
});

module.exports = Quote;
