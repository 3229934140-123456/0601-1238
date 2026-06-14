const { Notification } = require('../models');

async function createNotification(params) {
  const {
    recipientId,
    recipientType = 'customer',
    type = 'system',
    title,
    content,
    relatedType = null,
    relatedId = null,
    level = 'normal',
    senderId = null,
    senderName = '系统',
    extraData = null
  } = params;

  return Notification.create({
    recipientId,
    recipientType,
    type,
    title,
    content,
    relatedType,
    relatedId,
    level,
    senderId,
    senderName,
    extraData
  });
}

async function notifyOrderStatus(order, toStatus, recipientType = 'customer') {
  const statusMap = {
    pending: '待确认',
    confirmed: '已确认',
    in_production: '生产中',
    proofing: '打样中',
    proof_approved: '打样已确认',
    producing: '量产中',
    completed: '已完成',
    delivered: '已交付',
    cancelled: '已取消',
    refunded: '已退款'
  };

  const title = `订单状态更新: ${order.orderNo}`;
  const content = `您的订单「${order.title}」状态已更新为「${statusMap[toStatus] || toStatus}」`;

  return createNotification({
    recipientId: order.customerId,
    recipientType: 'customer',
    type: 'order',
    title,
    content,
    relatedType: 'order',
    relatedId: order.id,
    level: toStatus === 'delivered' || toStatus === 'completed' ? 'important' : 'normal'
  });
}

async function notifyDeliveryReminder(order) {
  const title = `交付提醒: ${order.orderNo}`;
  const content = `您的订单「${order.title}」预计今日交付，请留意收货。`;

  return createNotification({
    recipientId: order.customerId,
    recipientType: 'customer',
    type: 'delivery',
    title,
    content,
    relatedType: 'order',
    relatedId: order.id,
    level: 'important'
  });
}

module.exports = {
  createNotification,
  notifyOrderStatus,
  notifyDeliveryReminder
};
