const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recipientId: {
    type: DataTypes.INTEGER,
    field: 'recipient_id'
  },
  recipientType: {
    type: DataTypes.ENUM('customer', 'staff'),
    defaultValue: 'customer',
    field: 'recipient_type'
  },
  type: {
    type: DataTypes.ENUM('order', 'artwork', 'payment', 'system', 'delivery', 'review'),
    defaultValue: 'system'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT
  },
  relatedType: {
    type: DataTypes.STRING(50),
    field: 'related_type'
  },
  relatedId: {
    type: DataTypes.INTEGER,
    field: 'related_id'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_read'
  },
  readAt: {
    type: DataTypes.DATE,
    field: 'read_at'
  },
  level: {
    type: DataTypes.ENUM('normal', 'important', 'urgent'),
    defaultValue: 'normal'
  },
  senderId: {
    type: DataTypes.INTEGER,
    field: 'sender_id'
  },
  senderName: {
    type: DataTypes.STRING(50),
    field: 'sender_name'
  },
  extraData: {
    type: DataTypes.JSON,
    field: 'extra_data'
  }
}, {
  tableName: 'notifications'
});

module.exports = Notification;
