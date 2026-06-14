const { Op } = require('sequelize');
const {
  Order, OrderStatusLog, Customer, Artwork, Quote,
  PaperSpec, Store, User, Payment
} = require('../models');
const { success, error, paginate } = require('../utils/response');
const { generateOrderNo, generatePaymentNo } = require('../utils/generator');
const { notifyOrderStatus } = require('../utils/notification');

async function createOrder(req, res, next) {
  try {
    const {
      customerId, quoteId, artworkId, title,
      paperSpecId, paperSpecDetail, quantity = 1,
      size, processList, unitPrice, totalAmount,
      discount = 0, actualAmount, deliveryDate,
      deliveryAddress, contact, contactPhone,
      urgency = 'normal', storeId, remark,
      invoiceInfo, invoiceStatus = 'not_needed',
      source = 'online'
    } = req.body;

    if (!customerId) {
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
      customerId,
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

    const customer = await Customer.findByPk(customerId);
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

    if (req.customerId) {
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
          model: Payment,
          as: 'payments',
          order: [['id', 'DESC']]
        }
      ]
    });

    if (!order) {
      return error(res, '订单不存在', 404);
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

    const {
      title, quantity, deliveryDate, deliveryAddress,
      contact, contactPhone, urgency, storeId, remark,
      invoiceInfo, invoiceStatus, processList,
      totalAmount, discount, actualAmount
    } = req.body;

    await order.update({
      title, quantity, deliveryDate, deliveryAddress,
      contact, contactPhone, urgency, storeId, remark,
      invoiceInfo, invoiceStatus, processList,
      totalAmount, discount, actualAmount
    });

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
  updateOrderStatus
};
