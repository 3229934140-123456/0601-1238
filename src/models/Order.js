const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderNo: {
    type: DataTypes.STRING(32),
    unique: true,
    field: 'order_no'
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id'
  },
  quoteId: {
    type: DataTypes.INTEGER,
    field: 'quote_id'
  },
  artworkId: {
    type: DataTypes.INTEGER,
    field: 'artwork_id'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
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
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'unit_price'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_amount'
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  actualAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'actual_amount'
  },
  paidAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'paid_amount'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'in_production', 'proofing', 'proof_approved', 'producing', 'completed', 'shipped', 'delivered', 'cancelled', 'refunded'),
    defaultValue: 'pending'
  },
  proofStatus: {
    type: DataTypes.ENUM('not_started', 'pending_approval', 'approved', 'rejected'),
    defaultValue: 'not_started',
    field: 'proof_status'
  },
  deliveryDate: {
    type: DataTypes.DATE,
    field: 'delivery_date'
  },
  deliveryAddress: {
    type: DataTypes.STRING(255),
    field: 'delivery_address'
  },
  contact: {
    type: DataTypes.STRING(50)
  },
  contactPhone: {
    type: DataTypes.STRING(20),
    field: 'contact_phone'
  },
  urgency: {
    type: DataTypes.ENUM('normal', 'urgent', 'very_urgent'),
    defaultValue: 'normal'
  },
  storeId: {
    type: DataTypes.INTEGER,
    field: 'store_id'
  },
  assignedTo: {
    type: DataTypes.INTEGER,
    field: 'assigned_to'
  },
  confirmedBy: {
    type: DataTypes.INTEGER,
    field: 'confirmed_by'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    field: 'confirmed_at'
  },
  productionStartedAt: {
    type: DataTypes.DATE,
    field: 'production_started_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    field: 'completed_at'
  },
  deliveredAt: {
    type: DataTypes.DATE,
    field: 'delivered_at'
  },
  deliveryMethod: {
    type: DataTypes.STRING(50),
    field: 'delivery_method'
  },
  trackingNo: {
    type: DataTypes.STRING(100),
    field: 'tracking_no'
  },
  logisticsCompany: {
    type: DataTypes.STRING(100),
    field: 'logistics_company'
  },
  pickupCode: {
    type: DataTypes.STRING(50),
    field: 'pickup_code'
  },
  pickupStoreId: {
    type: DataTypes.INTEGER,
    field: 'pickup_store_id'
  },
  remark: {
    type: DataTypes.TEXT
  },
  source: {
    type: DataTypes.STRING(50),
    defaultValue: 'online'
  },
  invoiceInfo: {
    type: DataTypes.JSON,
    field: 'invoice_info'
  },
  invoiceStatus: {
    type: DataTypes.ENUM('not_needed', 'pending', 'issued', 'mailed'),
    defaultValue: 'not_needed',
    field: 'invoice_status'
  }
}, {
  tableName: 'orders'
});

module.exports = Order;
