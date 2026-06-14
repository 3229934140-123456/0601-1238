const { Op } = require('sequelize');
const {
  Order, OrderStatusLog, OrderProcess, Customer, Artwork, Quote,
  PaperSpec, Store, User, Payment
} = require('../models');
const { success, error, paginate } = require('../utils/response');
const { generateOrderNo, generatePaymentNo } = require('../utils/generator');
const { notifyOrderStatus } = require('../utils/notification');

function checkOrderOwnership(req, order) {
  if (req.userType === 'customer' && order.customerId !== req.customerId) {
    return false;
  }
  return true;
}

async function createOrder(req, res, next) {
  try {
    const {
      quoteId, artworkId, title,
      paperSpecId, paperSpecDetail, quantity = 1,
      size, processList, unitPrice, totalAmount,
      discount = 0, actualAmount, deliveryDate,
      deliveryAddress, contact, contactPhone,
      urgency = 'normal', storeId, remark,
      invoiceInfo, invoiceStatus = 'not_needed',
      source = 'online'
    } = req.body;

    let finalCustomerId;
    if (req.userType === 'customer') {
      finalCustomerId = req.customerId;
    } else {
      finalCustomerId = req.body.customerId;
    }

    if (!finalCustomerId) {
      return error(res, '客户ID不能为空', 400);
    }

    if (!title) {
      return error(res, '订单标题不能为空', 400);
    }

    const orderNo = generateOrderNo();

    let paperDetail = paperSpecDetail;
    if (paperSpecId && !paperDetail) {
      const paper = await PaperSpec.findByPk(paperSpecId);
      paperDetail = paper ? paper.toJSON() : null;
    }

    const order = await Order.create({
      orderNo,
      customerId: finalCustomerId,
      quoteId,
      artworkId,
      title,
      paperSpecId,
      paperSpecDetail: paperDetail,
      quantity,
      size,
      processList,
      unitPrice,
      totalAmount: totalAmount || actualAmount || 0,
      discount,
      actualAmount: actualAmount || totalAmount || 0,
      paidAmount: 0,
      status: 'pending',
      proofStatus: 'not_started',
      deliveryDate,
      deliveryAddress,
      contact,
      contactPhone,
      urgency,
      storeId,
      remark,
      invoiceInfo,
      invoiceStatus,
      source,
      confirmedBy: req.user?.id || null
    });

    await OrderStatusLog.create({
      orderId: order.id,
      fromStatus: null,
      toStatus: 'pending',
      remark: '订单创建',
      operatorId: req.user?.id || req.customerId || null,
      operatorType: req.userType === 'staff' ? 'staff' : 'customer',
      operatorName: req.user?.realName || '客户'
    });

    const customer = await Customer.findByPk(finalCustomerId);
    if (customer) {
      customer.increment('totalOrders');
      customer.increment('totalAmount', { by: actualAmount || totalAmount || 0 });
    }

    success(res, order, '订单创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getOrderList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      customerId,
      storeId,
      startDate,
      endDate,
      urgency
    } = req.query;

    const where = {};

    if (req.userType === 'customer') {
      where.customerId = req.customerId;
    } else if (customerId) {
      where.customerId = customerId;
    }

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { orderNo: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (storeId) {
      where.storeId = storeId;
    }

    if (urgency) {
      where.urgency = urgency;
    }

    if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        [Op.lte]: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'customerNo', 'name', 'contact', 'phone'] },
        { model: Store, as: 'store', attributes: ['id', 'name'] },
        { model: User, as: 'assignee', attributes: ['id', 'realName', 'username'] }
      ],
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize)
    });

    success(res, paginate(rows, page, pageSize, count));
  } catch (err) {
    next(err);
  }
}

async function getOrderDetail(req, res, next) {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Artwork, as: 'artwork' },
        { model: Quote, as: 'quote' },
        { model: PaperSpec, as: 'paperSpec' },
        { model: Store, as: 'store' },
        { model: User, as: 'assignee', attributes: ['id', 'realName', 'username'] },
        {
          model: OrderStatusLog,
          as: 'statusLogs',
          order: [['id', 'ASC']]
        },
        {
          model: OrderProcess,
          as: 'processes',
          order: [['sort', 'ASC']]
        },
        {
          model: Payment,
          as: 'payments',
          order: [['id', 'DESC']]
        }
      ]
    });

    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (req.userType === 'customer' && order.customerId !== req.customerId) {
      return error(res, '无权访问此订单', 403);
    }

    success(res, order);
  } catch (err) {
    next(err);
  }
}

async function updateOrder(req, res, next) {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权操作此订单', 403);
    }

    const {
      title, quantity, deliveryDate, deliveryAddress,
      contact, contactPhone, urgency, storeId, remark,
      invoiceInfo, invoiceStatus, processList,
      totalAmount, discount, actualAmount
    } = req.body;

    const updateData = {
      title, quantity, deliveryDate, deliveryAddress,
      contact, contactPhone, remark,
      invoiceInfo, processList
    };

    if (req.userType === 'staff') {
      updateData.urgency = urgency;
      updateData.storeId = storeId;
      updateData.invoiceStatus = invoiceStatus;
      updateData.totalAmount = totalAmount;
      updateData.discount = discount;
      updateData.actualAmount = actualAmount;
    }

    await order.update(updateData);

    success(res, order, '订单更新成功');
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(order, newStatus, operatorId, operatorType, operatorName, remark = '') {
  const oldStatus = order.status;

  if (oldStatus === newStatus) {
    return order;
  }

  await order.update({ status: newStatus });

  await OrderStatusLog.create({
    orderId: order.id,
    fromStatus: oldStatus,
    toStatus: newStatus,
    remark,
    operatorId,
    operatorType,
    operatorName
  });

  notifyOrderStatus(order, newStatus);

  return order;
}

async function confirmOrder(req, res, next) {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (order.status !== 'pending') {
      return error(res, '当前状态不允许确认', 400);
    }

    await updateOrderStatus(
      order,
      'confirmed',
      req.user?.id,
      'staff',
      req.user?.realName || '系统',
      '订单已确认'
    );

    await order.update({
      confirmedBy: req.user?.id,
      confirmedAt: new Date()
    });

    success(res, order, '订单已确认');
  } catch (err) {
    next(err);
  }
}

async function startProduction(req, res, next) {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (order.status !== 'confirmed' && order.status !== 'proof_approved') {
      return error(res, '当前状态不允许开始生产', 400);
    }

    await updateOrderStatus(
      order,
      order.proofStatus === 'not_started' ? 'in_production' : 'producing',
      req.user?.id,
      'staff',
      req.user?.realName || '系统',
      '开始生产'
    );

    await order.update({
      productionStartedAt: order.productionStartedAt || new Date()
    });

    success(res, order, '已开始生产');
  } catch (err) {
    next(err);
  }
}

async function completeOrder(req, res, next) {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (order.status !== 'producing' && order.status !== 'in_production') {
      return error(res, '当前状态不允许完成', 400);
    }

    await updateOrderStatus(
      order,
      'completed',
      req.user?.id,
      'staff',
      req.user?.realName || '系统',
      '订单生产完成'
    );

    await order.update({ completedAt: new Date() });

    success(res, order, '订单已完成');
  } catch (err) {
    next(err);
  }
}

async function deliverOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { deliveryMethod, trackingNo, remark } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (order.status !== 'completed') {
      return error(res, '当前状态不允许交付', 400);
    }

    await updateOrderStatus(
      order,
      'delivered',
      req.user?.id,
      'staff',
      req.user?.realName || '系统',
      remark || '订单已交付'
    );

    await order.update({
      deliveryMethod,
      trackingNo,
      deliveredAt: new Date()
    });

    success(res, order, '订单已交付');
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
      return error(res, '当前状态不允许取消', 400);
    }

    await updateOrderStatus(
      order,
      'cancelled',
      req.user?.id,
      'staff',
      req.user?.realName || '系统',
      reason || '订单取消'
    );

    success(res, order, '订单已取消');
  } catch (err) {
    next(err);
  }
}

async function assignOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { storeId, assignedTo, remark } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    await order.update({
      storeId: storeId || order.storeId,
      assignedTo: assignedTo || order.assignedTo
    });

    await OrderStatusLog.create({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      remark: remark || '订单分配',
      operatorId: req.user?.id,
      operatorType: 'staff',
      operatorName: req.user?.realName || '系统'
    });

    success(res, order, '订单分配成功');
  } catch (err) {
    next(err);
  }
}

async function getOrderStatusLogs(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权访问此订单', 403);
    }

    const logs = await OrderStatusLog.findAll({
      where: { orderId },
      order: [['id', 'ASC']]
    });

    success(res, logs);
  } catch (err) {
    next(err);
  }
}

async function registerPayment(req, res, next) {
  try {
    const { orderId } = req.params;
    const { amount, paymentMethod = 'bank_transfer', transactionNo, remark, receiptImage } = req.body;

    if (!amount || amount <= 0) {
      return error(res, '请输入有效金额', 400);
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    const paymentNo = generatePaymentNo();

    const payment = await Payment.create({
      paymentNo,
      orderId,
      customerId: order.customerId,
      amount,
      paymentMethod,
      transactionNo,
      status: 'confirmed',
      confirmedBy: req.user?.id,
      confirmedAt: new Date(),
      remark,
      receiptImage
    });

    const newPaidAmount = parseFloat(order.paidAmount || 0) + parseFloat(amount);
    await order.update({ paidAmount: parseFloat(newPaidAmount.toFixed(2)) });

    const customer = await Customer.findByPk(order.customerId);
    if (customer) {
      customer.increment('balance', { by: amount });
    }

    success(res, payment, '收款登记成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getOrderPayments(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权访问此订单', 403);
    }

    const payments = await Payment.findAll({
      where: { orderId },
      order: [['id', 'DESC']]
    });

    success(res, payments);
  } catch (err) {
    next(err);
  }
}

async function updateInvoiceInfo(req, res, next) {
  try {
    const { id } = req.params;
    const { invoiceInfo, invoiceStatus } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    await order.update({
      invoiceInfo,
      invoiceStatus: invoiceStatus || order.invoiceStatus
    });

    success(res, order, '发票信息更新成功');
  } catch (err) {
    next(err);
  }
}

const DEFAULT_PROCESSES = [
  { key: 'proofing', name: '打样', sort: 1 },
  { key: 'printing', name: '印刷', sort: 2 },
  { key: 'postpress', name: '后道', sort: 3 },
  { key: 'quality', name: '质检', sort: 4 },
  { key: 'packing', name: '打包', sort: 5 }
];

async function initOrderProcesses(orderId) {
  const existing = await OrderProcess.findAll({ where: { orderId } });
  if (existing.length > 0) return existing;

  const processes = await Promise.all(
    DEFAULT_PROCESSES.map(p => OrderProcess.create({
      orderId,
      processKey: p.key,
      processName: p.name,
      status: 'pending',
      sort: p.sort
    }))
  );
  return processes;
}

async function getOrderProcesses(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权访问此订单', 403);
    }

    let processes = await OrderProcess.findAll({
      where: { orderId },
      order: [['sort', 'ASC'], ['id', 'ASC']]
    });

    if (processes.length === 0) {
      processes = await initOrderProcesses(orderId);
    }

    success(res, processes);
  } catch (err) {
    next(err);
  }
}

async function updateProcessStatus(req, res, next) {
  try {
    const { orderId, processKey } = req.params;
    const { status, remark } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
      return error(res, '无效的工序状态', 400);
    }

    let process = await OrderProcess.findOne({
      where: { orderId, processKey }
    });

    if (!process) {
      const meta = DEFAULT_PROCESSES.find(p => p.key === processKey);
      if (!meta) {
        return error(res, '未知工序类型', 400);
      }
      process = await OrderProcess.create({
        orderId,
        processKey,
        processName: meta.name,
        status,
        sort: meta.sort
      });
    }

    const updateData = { status, remark };
    if (status === 'in_progress' && !process.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === 'completed' && !process.completedAt) {
      updateData.completedAt = new Date();
    }
    updateData.operatorId = req.user?.id;
    updateData.operatorName = req.user?.realName || '系统';

    await process.update(updateData);

    await OrderStatusLog.create({
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      remark: `${process.processName} 工序${status === 'completed' ? '完成' : status === 'in_progress' ? '开始' : status === 'skipped' ? '跳过' : '更新'}${remark ? `：${remark}` : ''}`,
      operatorId: req.user?.id,
      operatorType: 'staff',
      operatorName: req.user?.realName || '系统'
    });

    success(res, process, '工序进度已更新');
  } catch (err) {
    next(err);
  }
}

async function shipOrder(req, res, next) {
  try {
    const { id } = req.params;
    const {
      deliveryMethod = 'express',
      trackingNo,
      logisticsCompany,
      pickupStoreId,
      pickupCode,
      remark
    } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!['confirmed', 'in_production', 'producing', 'completed', 'shipped'].includes(order.status)) {
      return error(res, '当前状态不允许发货', 400);
    }

    if (deliveryMethod === 'express' && !trackingNo) {
      return error(res, '快递发货请填写物流单号', 400);
    }
    if (deliveryMethod === 'pickup' && !pickupCode) {
      return error(res, '自提请填写自提码', 400);
    }

    const oldStatus = order.status;

    const extraData = {};
    if (logisticsCompany) extraData.logisticsCompany = logisticsCompany;
    if (pickupStoreId) extraData.pickupStoreId = pickupStoreId;

    await order.update({
      deliveryMethod,
      trackingNo,
      pickupCode,
      pickupStoreId,
      status: 'shipped',
      ...extraData
    });

    await OrderStatusLog.create({
      orderId: id,
      fromStatus: oldStatus,
      toStatus: 'shipped',
      remark: deliveryMethod === 'pickup'
        ? `已备货，等待自提${pickupCode ? `，自提码：${pickupCode}` : ''}${remark ? `（${remark}）` : ''}`
        : `已发货${trackingNo ? `，物流单号：${trackingNo}` : ''}${logisticsCompany ? `（${logisticsCompany}）` : ''}${remark ? ` - ${remark}` : ''}`,
      operatorId: req.user?.id,
      operatorType: 'staff',
      operatorName: req.user?.realName || '系统'
    });

    const { createNotification } = require('../utils/notification');
    await createNotification({
      recipientId: order.customerId,
      recipientType: 'customer',
      type: 'delivery',
      title: deliveryMethod === 'pickup' ? '订单已到货，可前往自提' : '订单已发货',
      content: deliveryMethod === 'pickup'
        ? `您的订单「${order.title}」已备货完成，凭自提码「${pickupCode}」前往门店取货。`
        : `您的订单「${order.title}」已发货，物流单号：${trackingNo}，请注意查收。`,
      relatedType: 'order',
      relatedId: order.id,
      level: 'important',
      senderName: '系统',
      extraData: {
        deliveryMethod,
        trackingNo,
        pickupCode,
        logisticsCompany
      }
    });

    success(res, order, deliveryMethod === 'pickup' ? '已完成备货，可通知客户自提' : '发货成功');
  } catch (err) {
    next(err);
  }
}

async function confirmDelivery(req, res, next) {
  try {
    const { id } = req.params;
    const { remark } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (req.userType === 'customer' && order.customerId !== req.customerId) {
      return error(res, '无权操作此订单', 403);
    }

    if (!['shipped', 'completed'].includes(order.status)) {
      return error(res, '当前状态不允许确认交付', 400);
    }

    const oldStatus = order.status;

    await order.update({
      status: 'delivered',
      deliveredAt: new Date()
    });

    await OrderStatusLog.create({
      orderId: id,
      fromStatus: oldStatus,
      toStatus: 'delivered',
      remark: remark || (req.userType === 'customer' ? '客户确认已收货' : '已完成交付'),
      operatorId: req.user?.id || req.customerId,
      operatorType: req.userType === 'staff' ? 'staff' : 'customer',
      operatorName: req.user?.realName || '客户'
    });

    success(res, order, '订单已完成交付');
  } catch (err) {
    next(err);
  }
}

async function getOrderNotifications(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权访问此订单', 403);
    }

    const { Notification, ArtworkComment } = require('../models');

    const notifications = await Notification.findAll({
      where: {
        relatedType: 'order',
        relatedId: orderId,
        recipientId: req.user?.id || req.customerId,
        recipientType: req.userType === 'staff' ? 'staff' : 'customer'
      },
      order: [['id', 'DESC']]
    });

    const artworkComments = [];
    if (order.artworkId) {
      const comments = await ArtworkComment.findAll({
        where: { artworkId: order.artworkId },
        order: [['id', 'DESC']],
        limit: 20
      });
      comments.forEach(c => {
        notifications.push({
          id: `comment-${c.id}`,
          type: 'artwork',
          title: '稿件评论',
          content: c.content,
          relatedType: 'artwork',
          relatedId: order.artworkId,
          isRead: false,
          level: 'normal',
          senderName: c.commenterName,
          createdAt: c.createdAt,
          isComment: true,
          commentType: c.commentType
        });
      });
    }

    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const grouped = {
      all: notifications,
      byType: {
        order: notifications.filter(n => n.type === 'order' && !n.isComment),
        artwork: notifications.filter(n => n.type === 'artwork'),
        payment: notifications.filter(n => n.type === 'payment'),
        delivery: notifications.filter(n => n.type === 'delivery'),
        review: notifications.filter(n => n.type === 'review'),
        system: notifications.filter(n => n.type === 'system')
      },
      unreadCount: notifications.filter(n => !n.isRead && !n.isComment).length
    };

    success(res, grouped);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  getOrderList,
  getOrderDetail,
  updateOrder,
  confirmOrder,
  startProduction,
  completeOrder,
  deliverOrder,
  cancelOrder,
  assignOrder,
  getOrderStatusLogs,
  registerPayment,
  getOrderPayments,
  updateInvoiceInfo,
  updateOrderStatus,
  initOrderProcesses,
  getOrderProcesses,
  updateProcessStatus,
  shipOrder,
  confirmDelivery,
  getOrderNotifications
};
