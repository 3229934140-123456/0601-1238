const sequelize = require('../config/database');
const User = require('./User');
const Customer = require('./Customer');
const Artwork = require('./Artwork');
const ArtworkVersion = require('./ArtworkVersion');
const ArtworkComment = require('./ArtworkComment');
const PaperSpec = require('./PaperSpec');
const ProcessSpec = require('./ProcessSpec');
const Quote = require('./Quote');
const Order = require('./Order');
const OrderStatusLog = require('./OrderStatusLog');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Store = require('./Store');
const Settlement = require('./Settlement');
const Review = require('./Review');

const db = {
  sequelize,
  User,
  Customer,
  Artwork,
  ArtworkVersion,
  ArtworkComment,
  PaperSpec,
  ProcessSpec,
  Quote,
  Order,
  OrderStatusLog,
  Payment,
  Notification,
  Store,
  Settlement,
  Review
};

Customer.belongsTo(User, { as: 'salesUser', foreignKey: 'sales_user_id' });
Customer.hasMany(Order, { as: 'orders', foreignKey: 'customer_id' });
Customer.hasMany(Artwork, { as: 'artworks', foreignKey: 'customer_id' });
Customer.hasMany(Quote, { as: 'quotes', foreignKey: 'customer_id' });
Customer.hasMany(Payment, { as: 'payments', foreignKey: 'customer_id' });
Customer.hasMany(Settlement, { as: 'settlements', foreignKey: 'customer_id' });
Customer.hasMany(Review, { as: 'reviews', foreignKey: 'customer_id' });
Customer.hasMany(Notification, { as: 'notifications', foreignKey: 'recipient_id', constraints: false });

Artwork.belongsTo(Customer, { as: 'customer', foreignKey: 'customer_id' });
Artwork.hasMany(ArtworkVersion, { as: 'versions', foreignKey: 'artwork_id' });
Artwork.hasMany(ArtworkComment, { as: 'comments', foreignKey: 'artwork_id' });
Artwork.hasMany(Quote, { as: 'quotes', foreignKey: 'artwork_id' });
Artwork.hasMany(Order, { as: 'orders', foreignKey: 'artwork_id' });

ArtworkVersion.belongsTo(Artwork, { as: 'artwork', foreignKey: 'artwork_id' });

ArtworkComment.belongsTo(Artwork, { as: 'artwork', foreignKey: 'artwork_id' });
ArtworkComment.belongsTo(ArtworkVersion, { as: 'version', foreignKey: 'version_id' });

Quote.belongsTo(Customer, { as: 'customer', foreignKey: 'customer_id' });
Quote.belongsTo(Artwork, { as: 'artwork', foreignKey: 'artwork_id' });
Quote.belongsTo(PaperSpec, { as: 'paperSpec', foreignKey: 'paper_spec_id' });

Order.belongsTo(Customer, { as: 'customer', foreignKey: 'customer_id' });
Order.belongsTo(Artwork, { as: 'artwork', foreignKey: 'artwork_id' });
Order.belongsTo(Quote, { as: 'quote', foreignKey: 'quote_id' });
Order.belongsTo(PaperSpec, { as: 'paperSpec', foreignKey: 'paper_spec_id' });
Order.belongsTo(Store, { as: 'store', foreignKey: 'store_id' });
Order.belongsTo(User, { as: 'assignee', foreignKey: 'assigned_to' });
Order.belongsTo(User, { as: 'confirmer', foreignKey: 'confirmed_by' });
Order.hasMany(OrderStatusLog, { as: 'statusLogs', foreignKey: 'order_id' });
Order.hasMany(Payment, { as: 'payments', foreignKey: 'order_id' });
Order.hasOne(Review, { as: 'review', foreignKey: 'order_id' });

OrderStatusLog.belongsTo(Order, { as: 'order', foreignKey: 'order_id' });

Payment.belongsTo(Order, { as: 'order', foreignKey: 'order_id' });
Payment.belongsTo(Customer, { as: 'customer', foreignKey: 'customer_id' });

Notification.belongsTo(Customer, { as: 'recipientCustomer', foreignKey: 'recipient_id', constraints: false });
Notification.belongsTo(User, { as: 'recipientUser', foreignKey: 'recipient_id', constraints: false });

Store.hasMany(Order, { as: 'orders', foreignKey: 'store_id' });
Store.hasMany(User, { as: 'users', foreignKey: 'store_id' });

Settlement.belongsTo(Customer, { as: 'customer', foreignKey: 'customer_id' });

Review.belongsTo(Order, { as: 'order', foreignKey: 'order_id' });
Review.belongsTo(Customer, { as: 'customer', foreignKey: 'customer_id' });
Review.belongsTo(User, { as: 'repliedByUser', foreignKey: 'replied_by' });

User.belongsTo(Store, { as: 'store', foreignKey: 'store_id' });

module.exports = db;
