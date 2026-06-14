const { Op } = require('sequelize');
const { Notification } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { createNotification } = require('../utils/notification');

function checkNotificationOwnership(req, notification) {
  const recipientId = req.user?.id || req.customerId;
  const recipientType = req.userType === 'staff' ? 'staff' : 'customer';
  return notification.recipientId === recipientId && notification.recipientType === recipientType;
}

async function getNotificationList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 20,
      type,
      isRead,
      level
    } = req.query;

    const recipientId = req.user?.id || req.customerId;
    const recipientType = req.userType === 'staff' ? 'staff' : 'customer';

    const where = {
      recipientId,
      recipientType
    };

    if (type) {
      where.type = type;
    }

    if (isRead !== undefined && isRead !== null) {
      where.isRead = isRead === 'true' || isRead === true;
    }

    if (level) {
      where.level = level;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['isRead', 'ASC'], ['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize)
    });

    const unreadCount = await Notification.count({
      where: {
        recipientId,
        recipientType,
        isRead: false
      }
    });

    success(res, {
      ...paginate(rows, page, pageSize, count),
      unreadCount
    });
  } catch (err) {
    next(err);
  }
}

async function getNotificationDetail(req, res, next) {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return error(res, '通知不存在', 404);
    }

    if (!checkNotificationOwnership(req, notification)) {
      return error(res, '无权访问此通知', 403);
    }

    if (!notification.isRead) {
      await notification.update({
        isRead: true,
        readAt: new Date()
      });
    }

    success(res, notification);
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return error(res, '通知不存在', 404);
    }

    if (!checkNotificationOwnership(req, notification)) {
      return error(res, '无权操作此通知', 403);
    }

    await notification.update({
      isRead: true,
      readAt: new Date()
    });

    success(res, notification, '已标记为已读');
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const recipientId = req.user?.id || req.customerId;
    const recipientType = req.userType === 'staff' ? 'staff' : 'customer';

    await Notification.update(
      {
        isRead: true,
        readAt: new Date()
      },
      {
        where: {
          recipientId,
          recipientType,
          isRead: false
        }
      }
    );

    success(res, null, '全部已标记为已读');
  } catch (err) {
    next(err);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const recipientId = req.user?.id || req.customerId;
    const recipientType = req.userType === 'staff' ? 'staff' : 'customer';

    const count = await Notification.count({
      where: {
        recipientId,
        recipientType,
        isRead: false
      }
    });

    success(res, { count });
  } catch (err) {
    next(err);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return error(res, '通知不存在', 404);
    }

    if (!checkNotificationOwnership(req, notification)) {
      return error(res, '无权操作此通知', 403);
    }

    await notification.destroy();

    success(res, null, '通知已删除');
  } catch (err) {
    next(err);
  }
}

async function sendNotification(req, res, next) {
  try {
    const {
      recipientId,
      recipientType = 'customer',
      type = 'system',
      title,
      content,
      relatedType,
      relatedId,
      level = 'normal'
    } = req.body;

    if (!recipientId || !title) {
      return error(res, '接收人和标题不能为空', 400);
    }

    const notification = await createNotification({
      recipientId,
      recipientType,
      type,
      title,
      content,
      relatedType,
      relatedId,
      level,
      senderId: req.user?.id,
      senderName: req.user?.realName || '系统'
    });

    success(res, notification, '通知发送成功', 201);
  } catch (err) {
    next(err);
  }
}

async function triggerDeliveryReminders(req, res, next) {
  try {
    const { Order, Notification } = require('../models');
    const { Op } = require('sequelize');
    const { days = 1 } = req.query;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(startOfToday);
    targetDate.setDate(targetDate.getDate() + parseInt(days));
    const endOfTargetDate = new Date(targetDate);
    endOfTargetDate.setHours(23, 59, 59, 999);

    const orders = await Order.findAll({
      where: {
        status: { [Op.in]: ['in_production', 'producing', 'completed'] },
        deliveryDate: {
          [Op.between]: [startOfToday, endOfTargetDate]
        }
      },
      include: [{ model: require('../models').Customer, as: 'customer' }]
    });

    let createdCount = 0;
    let skippedCount = 0;
    const todayStr = startOfToday.toISOString().slice(0, 10);

    for (const order of orders) {
      const existingNotif = await Notification.findOne({
        where: {
          recipientId: order.customerId,
          recipientType: 'customer',
          type: 'delivery',
          relatedType: 'order',
          relatedId: order.id,
          createdAt: {
            [Op.gte]: startOfToday
          }
        }
      });

      if (existingNotif) {
        skippedCount++;
        continue;
      }

      await createNotification({
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'delivery',
        title: `交付提醒: ${order.orderNo}`,
        content: `您的订单「${order.title}」预计将于近期交付，请留意收货。`,
        relatedType: 'order',
        relatedId: order.id,
        level: 'important',
        senderName: '系统',
        extraData: { triggerDate: todayStr }
      });

      createdCount++;
    }

    success(res, {
      scannedOrders: orders.length,
      createdNotifications: createdCount,
      skippedDuplicates: skippedCount,
      dateRange: {
        from: startOfToday.toISOString(),
        to: endOfTargetDate.toISOString()
      }
    }, '交付提醒触发完成');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotificationList,
  getNotificationDetail,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  sendNotification,
  triggerDeliveryReminders
};
