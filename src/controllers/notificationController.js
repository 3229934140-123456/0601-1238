const { Op } = require('sequelize');
const { Notification } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { createNotification } = require('../utils/notification');

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

module.exports = {
  getNotificationList,
  getNotificationDetail,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  sendNotification
};
