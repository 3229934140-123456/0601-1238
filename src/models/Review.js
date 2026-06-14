const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Review = sequelize.define('Review', {
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
  customerId: {
    type: DataTypes.INTEGER,
    field: 'customer_id'
  },
  qualityRating: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    field: 'quality_rating'
  },
  serviceRating: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    field: 'service_rating'
  },
  deliveryRating: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    field: 'delivery_rating'
  },
  overallRating: {
    type: DataTypes.DECIMAL(3, 1),
    defaultValue: 5.0,
    field: 'overall_rating'
  },
  content: {
    type: DataTypes.TEXT
  },
  images: {
    type: DataTypes.JSON
  },
  replyContent: {
    type: DataTypes.TEXT,
    field: 'reply_content'
  },
  repliedAt: {
    type: DataTypes.DATE,
    field: 'replied_at'
  },
  repliedBy: {
    type: DataTypes.INTEGER,
    field: 'replied_by'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_anonymous'
  }
}, {
  tableName: 'reviews'
});

module.exports = Review;
