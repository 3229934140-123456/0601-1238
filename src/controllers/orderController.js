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

    await initOrderProcesses(order.id);

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
      statuses,
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

    if (statuses) {
      const statusList = statuses.split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length > 0) {
        where.status = { [Op.in]: statusList };
      }
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

    if (!order.processes || order.processes.length < DEFAULT_PROCESSES.length) {
      await initOrderProcesses(order.id);
      const freshProcesses = await OrderProcess.findAll({
        where: { orderId: id },
        order: [['sort', 'ASC']]
      });
      order.setDataValue('processes', freshProcesses);
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

    const { createNotification } = require('../utils/notification');
    await createNotification({
      recipientId: order.customerId,
      recipientType: 'customer',
      type: 'payment',
      title: `收款到账: ${order.orderNo}`,
      content: `您的订单「${order.title}」已收到款项 ¥${parseFloat(amount).toFixed(2)}（${paymentMethod === 'bank_transfer' ? '银行转账' : paymentMethod === 'alipay' ? '支付宝' : paymentMethod === 'wechat' ? '微信' : paymentMethod}），累计已付 ¥${parseFloat(newPaidAmount).toFixed(2)}。`,
      relatedType: 'order',
      relatedId: order.id,
      level: 'normal',
      senderName: '系统',
      extraData: { paymentNo, amount, paymentMethod, totalPaid: newPaidAmount }
    });

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
  const existingKeys = existing.map(p => p.processKey);
  
  if (existing.length >= DEFAULT_PROCESSES.length) {
    return existing.sort((a, b) => a.sort - b.sort);
  }

  const missing = DEFAULT_PROCESSES.filter(p => !existingKeys.includes(p.key));
  const created = await Promise.all(
    missing.map(p => OrderProcess.create({
      orderId,
      processKey: p.key,
      processName: p.name,
      status: 'pending',
      sort: p.sort
    }))
  );

  const all = [...existing, ...created];
  return all.sort((a, b) => a.sort - b.sort);
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
    const { status, remark, exceptionReason, reworkReason } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped', 'exception', 'rework'];
    if (!validStatuses.includes(status)) {
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
    if (status === 'exception') {
      updateData.exceptionReason = exceptionReason || remark || '';
    }
    if (status === 'rework') {
      updateData.reworkCount = (process.reworkCount || 0) + 1;
      updateData.reworkReason = reworkReason || remark || '';
      updateData.completedAt = null;
    }
    updateData.operatorId = req.user?.id;
    updateData.operatorName = req.user?.realName || '系统';

    await process.update(updateData);

    const statusLabels = {
      completed: '完成',
      in_progress: '开始',
      skipped: '跳过',
      exception: '异常',
      rework: '返工'
    };
    let logRemark = `${process.processName} 工序${statusLabels[status] || '更新'}`;
    if (status === 'exception') {
      logRemark += `，原因：${exceptionReason || remark || '未填写'}`;
      logRemark += '，等待处理';
    } else if (status === 'rework') {
      logRemark += `（第${process.reworkCount}次），原因：${reworkReason || remark || '未填写'}`;
    } else if (remark) {
      logRemark += `：${remark}`;
    }

    await OrderStatusLog.create({
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      remark: logRemark,
      operatorId: req.user?.id,
      operatorType: 'staff',
      operatorName: req.user?.realName || '系统'
    });

    if (status === 'exception') {
      const { createNotification } = require('../utils/notification');
      await createNotification({
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'order',
        title: `生产异常通知: ${order.orderNo}`,
        content: `您的订单「${order.title}」的 ${process.processName} 工序出现异常：${exceptionReason || remark || '原因未填写'}，我们将尽快处理。`,
        relatedType: 'order',
        relatedId: order.id,
        level: 'urgent',
        senderName: '系统',
        extraData: { processKey, exceptionReason: exceptionReason || remark }
      });
    }

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

    const { createNotification } = require('../utils/notification');
    await createNotification({
      recipientId: order.customerId,
      recipientType: 'customer',
      type: 'delivery',
      title: `订单已交付: ${order.orderNo}`,
      content: req.userType === 'customer'
        ? `您已确认收到订单「${order.title}」的货物，订单完成交付。`
        : `您的订单「${order.title}」已由门店确认完成交付。`,
      relatedType: 'order',
      relatedId: order.id,
      level: 'important',
      senderName: '系统',
      extraData: {
        deliveryMethod: order.deliveryMethod,
        trackingNo: order.trackingNo,
        confirmedBy: req.userType === 'staff' ? 'staff' : 'customer'
      }
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

    const recipientId = req.user?.id || req.customerId;
    const recipientType = req.userType === 'staff' ? 'staff' : 'customer';

    const notifications = await Notification.findAll({
      where: {
        relatedType: 'order',
        relatedId: orderId,
        recipientId,
        recipientType
      },
      order: [['id', 'DESC']]
    });

    const result = notifications.map(n => n.toJSON());

    if (order.artworkId) {
      const comments = await ArtworkComment.findAll({
        where: { artworkId: order.artworkId },
        order: [['id', 'DESC']],
        limit: 20
      });
      comments.forEach(c => {
        result.push({
          id: `comment-${c.id}`,
          type: 'artwork',
          title: '稿件评论',
          content: c.content,
          relatedType: 'artwork',
          relatedId: order.artworkId,
          isRead: true,
          level: 'normal',
          senderName: c.commenterName,
          createdAt: c.createdAt,
          isComment: true,
          commentType: c.commentType
        });
      });
    }

    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const grouped = {
      all: result,
      byType: {
        order: result.filter(n => n.type === 'order' && !n.isComment),
        artwork: result.filter(n => n.type === 'artwork'),
        payment: result.filter(n => n.type === 'payment'),
        delivery: result.filter(n => n.type === 'delivery'),
        review: result.filter(n => n.type === 'review'),
        system: result.filter(n => n.type === 'system')
      },
      unreadCount: result.filter(n => !n.isRead && !n.isComment).length
    };

    success(res, grouped);
  } catch (err) {
    next(err);
  }
}

async function markOrderNotificationsAsRead(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权操作此订单', 403);
    }

    const { Notification } = require('../models');
    const recipientId = req.user?.id || req.customerId;
    const recipientType = req.userType === 'staff' ? 'staff' : 'customer';

    const updated = await Notification.update(
      {
        isRead: true,
        readAt: new Date()
      },
      {
        where: {
          relatedType: 'order',
          relatedId: orderId,
          recipientId,
          recipientType,
          isRead: false
        }
      }
    );

    success(res, { markedCount: updated[0] }, `已标记 ${updated[0]} 条通知为已读`);
  } catch (err) {
    next(err);
  }
}

async function validateShipItem(item, allOrders) {
  const result = { ...item, valid: true, errors: [] };

  if (!item.orderId && !item.orderNo) {
    result.valid = false;
    result.errors.push('请提供订单ID或订单号');
    return result;
  }

  let order;
  if (item.orderNo) {
    order = allOrders.find(o => o.orderNo === item.orderNo);
    if (order) result.orderId = order.id;
  } else {
    order = allOrders.find(o => o.id === parseInt(item.orderId));
  }

  if (!order) {
    result.valid = false;
    result.errors.push(`订单不存在`);
    return result;
  }

  result.orderId = order.id;
  result.orderNo = order.orderNo;
  result.orderTitle = order.title;
  result.currentStatus = order.status;

  if (!['confirmed', 'in_production', 'producing', 'completed', 'shipped'].includes(order.status)) {
    result.valid = false;
    result.errors.push(`订单状态为${order.status}，不允许发货`);
    return result;
  }

  const deliveryMethod = item.deliveryMethod || 'express';
  if (deliveryMethod === 'express' && !item.trackingNo) {
    result.valid = false;
    result.errors.push('快递发货请填写物流单号');
    return result;
  }
  if (deliveryMethod === 'pickup' && !item.pickupCode) {
    result.valid = false;
    result.errors.push('自提请填写自提码');
    return result;
  }

  result.deliveryMethod = deliveryMethod;
  return result;
}

async function previewBatchShip(req, res, next) {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return error(res, '请提供要导入的订单列表', 400);
    }

    if (orders.length > 100) {
      return error(res, '单次批量处理不超过100个订单', 400);
    }

    const searchParams = [];
    for (const item of orders) {
      if (item.orderId) searchParams.push({ id: parseInt(item.orderId) });
      if (item.orderNo) searchParams.push({ orderNo: item.orderNo });
    }

    const allOrders = await Order.findAll({
      where: { [Op.or]: searchParams }
    });

    const results = [];
    for (const item of orders) {
      const validated = await validateShipItem(item, allOrders);
      results.push(validated);
    }

    const valid = results.filter(r => r.valid);
    const invalid = results.filter(r => !r.valid);

    success(res, {
      preview: results,
      summary: {
        total: results.length,
        valid: valid.length,
        invalid: invalid.length
      },
      canConfirm: valid.length > 0
    });
  } catch (err) {
    next(err);
  }
}

async function confirmBatchShip(req, res, next) {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return error(res, '请提供要确认的订单列表', 400);
    }

    if (orders.length > 100) {
      return error(res, '单次批量处理不超过100个订单', 400);
    }

    const searchParams = [];
    for (const item of orders) {
      if (item.orderId) searchParams.push({ id: parseInt(item.orderId) });
      if (item.orderNo) searchParams.push({ orderNo: item.orderNo });
    }

    const allOrders = await Order.findAll({
      where: { [Op.or]: searchParams }
    });

    const results = { success: [], failed: [] };
    const { createNotification } = require('../utils/notification');

    for (const item of orders) {
      try {
        const validated = await validateShipItem(item, allOrders);
        if (!validated.valid) {
          results.failed.push({
            orderId: validated.orderId || item.orderId,
            orderNo: validated.orderNo || item.orderNo,
            reason: validated.errors.join('; ')
          });
          continue;
        }

        const order = await Order.findByPk(validated.orderId);
        if (!order) {
          results.failed.push({ orderId: validated.orderId, reason: '订单不存在' });
          continue;
        }

        const oldStatus = order.status;
        const deliveryMethod = validated.deliveryMethod;
        const { trackingNo, logisticsCompany, pickupCode, pickupStoreId, remark } = validated;

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
          orderId: validated.orderId,
          fromStatus: oldStatus,
          toStatus: 'shipped',
          remark: deliveryMethod === 'pickup'
            ? `已备货，等待自提${pickupCode ? `，自提码：${pickupCode}` : ''}${remark ? `（${remark}）` : ''}`
            : `已发货${trackingNo ? `，物流单号：${trackingNo}` : ''}${logisticsCompany ? `（${logisticsCompany}）` : ''}${remark ? ` - ${remark}` : ''}`,
          operatorId: req.user?.id,
          operatorType: 'staff',
          operatorName: req.user?.realName || '系统'
        });

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
          senderName: '系统'
        });

        results.success.push({
          orderId: validated.orderId,
          orderNo: validated.orderNo,
          status: 'shipped'
        });
      } catch (itemErr) {
        results.failed.push({
          orderId: item.orderId,
          orderNo: item.orderNo,
          reason: itemErr.message
        });
      }
    }

    success(res, results, `批量发货完成：成功${results.success.length}个，失败${results.failed.length}个`);
  } catch (err) {
    next(err);
  }
}

async function batchShipOrders(req, res, next) {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return error(res, '请提供要发货的订单列表', 400);
    }

    if (orders.length > 50) {
      return error(res, '单次批量处理不超过50个订单', 400);
    }

    const results = { success: [], failed: [] };

    for (const item of orders) {
      try {
        const { orderId, deliveryMethod = 'express', trackingNo, logisticsCompany, pickupCode, pickupStoreId, remark } = item;

        const order = await Order.findByPk(orderId);
        if (!order) {
          results.failed.push({ orderId, reason: '订单不存在' });
          continue;
        }

        if (!['confirmed', 'in_production', 'producing', 'completed', 'shipped'].includes(order.status)) {
          results.failed.push({ orderId, reason: `订单状态为${order.status}，不允许发货` });
          continue;
        }

        if (deliveryMethod === 'express' && !trackingNo) {
          results.failed.push({ orderId, reason: '快递发货请填写物流单号' });
          continue;
        }
        if (deliveryMethod === 'pickup' && !pickupCode) {
          results.failed.push({ orderId, reason: '自提请填写自提码' });
          continue;
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
          orderId,
          fromStatus: oldStatus,
          toStatus: 'shipped',
          remark: deliveryMethod === 'pickup'
            ? `已备货，等待自提${pickupCode ? `，自提码：${pickupCode}` : ''}`
            : `已发货${trackingNo ? `，物流单号：${trackingNo}` : ''}${logisticsCompany ? `（${logisticsCompany}）` : ''}`,
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
          senderName: '系统'
        });

        results.success.push({ orderId, orderNo: order.orderNo, status: 'shipped' });
      } catch (itemErr) {
        results.failed.push({ orderId: item.orderId, reason: itemErr.message });
      }
    }

    success(res, results, `批量发货完成：成功${results.success.length}个，失败${results.failed.length}个`);
  } catch (err) {
    next(err);
  }
}

async function requestBalancePayment(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权操作此订单', 403);
    }

    const remaining = parseFloat(order.actualAmount || 0) - parseFloat(order.paidAmount || 0);
    if (remaining <= 0) {
      return error(res, '该订单已付清，无需催款', 400);
    }

    const { createNotification } = require('../utils/notification');
    await createNotification({
      recipientId: order.customerId,
      recipientType: 'customer',
      type: 'payment',
      title: `付款提醒: ${order.orderNo}`,
      content: `您的订单「${order.title}」尚有尾款 ¥${remaining.toFixed(2)} 未支付，请尽快安排付款。`,
      relatedType: 'order',
      relatedId: order.id,
      level: 'important',
      senderName: req.user?.realName || '系统',
      extraData: { remainingAmount: remaining, totalAmount: order.actualAmount, paidAmount: order.paidAmount }
    });

    await OrderStatusLog.create({
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      remark: `已发送付款提醒，尾款 ¥${remaining.toFixed(2)}`,
      operatorId: req.user?.id,
      operatorType: 'staff',
      operatorName: req.user?.realName || '系统'
    });

    success(res, { remainingAmount: remaining }, '付款提醒已发送');
  } catch (err) {
    next(err);
  }
}

async function registerRefund(req, res, next) {
  try {
    const { orderId } = req.params;
    const { refundAmount, refundReason, remark, receiptImage } = req.body;

    if (!refundAmount || refundAmount <= 0) {
      return error(res, '请输入有效退款金额', 400);
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (req.userType === 'customer' && order.customerId !== req.customerId) {
      return error(res, '无权操作此订单', 403);
    }

    if (['cancelled', 'refunded'].includes(order.status)) {
      return error(res, '当前订单状态不允许退款', 400);
    }

    const totalPaid = parseFloat(order.paidAmount || 0);
    if (parseFloat(refundAmount) > totalPaid) {
      return error(res, `退款金额不能超过已付金额 ¥${totalPaid.toFixed(2)}`, 400);
    }

    const paymentNo = generatePaymentNo();

    const payment = await Payment.create({
      paymentNo,
      orderId,
      customerId: order.customerId,
      amount: -parseFloat(refundAmount),
      paymentMethod: 'other',
      status: 'refunded',
      confirmedBy: req.user?.id,
      confirmedAt: new Date(),
      refundAmount: parseFloat(refundAmount),
      refundReason,
      refundBy: req.user?.id,
      refundAt: new Date(),
      remark,
      receiptImage
    });

    const newPaidAmount = totalPaid - parseFloat(refundAmount);
    await order.update({
      paidAmount: parseFloat(newPaidAmount.toFixed(2)),
      status: newPaidAmount <= 0 ? 'refunded' : order.status
    });

    const customer = await Customer.findByPk(order.customerId);
    if (customer) {
      customer.decrement('balance', { by: refundAmount });
    }

    await OrderStatusLog.create({
      orderId,
      fromStatus: order.status,
      toStatus: newPaidAmount <= 0 ? 'refunded' : order.status,
      remark: `已登记退款 ¥${parseFloat(refundAmount).toFixed(2)}${refundReason ? `，原因：${refundReason}` : ''}`,
      operatorId: req.user?.id,
      operatorType: req.userType === 'staff' ? 'staff' : 'customer',
      operatorName: req.user?.realName || '客户'
    });

    const { createNotification } = require('../utils/notification');
    await createNotification({
      recipientId: order.customerId,
      recipientType: 'customer',
      type: 'payment',
      title: `退款通知: ${order.orderNo}`,
      content: `您的订单「${order.title}」已登记退款 ¥${parseFloat(refundAmount).toFixed(2)}${refundReason ? `（原因：${refundReason}）` : ''}，请注意查收。`,
      relatedType: 'order',
      relatedId: order.id,
      level: 'important',
      senderName: req.user?.realName || '系统',
      extraData: { refundAmount, refundReason, paymentNo, remainingAmount: newPaidAmount }
    });

    success(res, payment, '退款登记成功', 201);
  } catch (err) {
    next(err);
  }
}

const PROCESS_ADVICE = {
  proofing: {
    pending: '请安排打样人员开始打样',
    in_progress: '请关注打样进度，及时与客户确认',
    exception: '请排查异常原因，必要时重新打样',
    rework: '请根据返工原因调整后重新打样',
    completed: '打样已完成，请推进到下一工序'
  },
  printing: {
    pending: '请安排印刷人员准备印刷',
    in_progress: '请关注印刷质量，确保色差在允许范围内',
    exception: '请检查印刷设备或材料，排除异常',
    rework: '请根据返工原因重新印刷',
    completed: '印刷已完成，请推进到下一工序'
  },
  postpress: {
    pending: '请安排后道工序处理（覆膜/模切/装订等）',
    in_progress: '请关注后道工艺质量',
    exception: '请排查后道设备或工艺问题',
    rework: '请根据返工原因重新处理',
    completed: '后道已完成，请推进到下一工序'
  },
  quality: {
    pending: '请安排质检人员进行质量检查',
    in_progress: '质检进行中，请耐心等待',
    exception: '质检发现问题，请记录原因并安排返工',
    rework: '请根据质检问题重新处理后再次质检',
    completed: '质检已通过，请推进到下一工序'
  },
  packing: {
    pending: '请安排打包人员进行包装',
    in_progress: '打包进行中',
    exception: '请检查包装材料或方式',
    rework: '请根据返工原因重新打包',
    completed: '打包已完成，订单可发货'
  }
};

function calcStayHours(date) {
  if (!date) return 0;
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60));
}

function getCurrentProcess(processes) {
  if (!processes || processes.length === 0) return null;
  
  const sorted = [...processes].sort((a, b) => a.sort - b.sort);
  
  for (const p of sorted) {
    if (p.status === 'exception' || p.status === 'rework') {
      return p;
    }
  }
  
  for (const p of sorted) {
    if (p.status === 'in_progress') {
      return p;
    }
  }
  
  for (const p of sorted) {
    if (p.status === 'pending') {
      return p;
    }
  }
  
  return sorted[sorted.length - 1];
}

async function getProductionBoard(req, res, next) {
  try {
    const { status = 'in_production' } = req.query;

    const where = {};
    where.status = {
      [Op.in]: ['in_production', 'proofing', 'producing', 'completed']
    };

    if (status && status !== 'all') {
      where.status = { [Op.in]: status.split(',') };
    }

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'contact', 'phone']
        },
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'realName', 'username', 'phone']
        },
        {
          model: OrderProcess,
          as: 'processes',
          order: [['sort', 'ASC']]
        }
      ],
      order: [['urgency', 'DESC'], ['id', 'DESC']]
    });

    const grouped = {
      proofing: [],
      printing: [],
      postpress: [],
      quality: [],
      packing: [],
      completed: []
    };

    for (const order of orders) {
      const processes = order.processes || [];
      const currentProc = getCurrentProcess(processes);
      
      if (!currentProc) continue;

      const stayHours = calcStayHours(currentProc.updatedAt || currentProc.startedAt || order.productionStartedAt);
      const advice = PROCESS_ADVICE[currentProc.processKey]?.[currentProc.status] || '请跟进处理';

      const orderData = order.toJSON();
      orderData.currentProcess = {
        key: currentProc.processKey,
        name: currentProc.processName,
        status: currentProc.status,
        startedAt: currentProc.startedAt,
        updatedAt: currentProc.updatedAt,
        completedAt: currentProc.completedAt,
        exceptionReason: currentProc.exceptionReason,
        reworkCount: currentProc.reworkCount,
        reworkReason: currentProc.reworkReason,
        remark: currentProc.remark,
        operatorName: currentProc.operatorName,
        stayHours,
        nextAdvice: advice
      };
      delete orderData.processes;

      let groupKey = currentProc.processKey;
      if (currentProc.status === 'completed' && groupKey === 'packing') {
        groupKey = 'completed';
      }

      grouped[groupKey].push(orderData);
    }

    const summary = {};
    for (const key of Object.keys(grouped)) {
      const processMeta = DEFAULT_PROCESSES.find(p => p.key === key);
      summary[key] = {
        name: key === 'completed' ? '已完成待发货' : processMeta?.name || key,
        count: grouped[key].length,
        exceptionCount: grouped[key].filter(o => o.currentProcess.status === 'exception').length,
        reworkCount: grouped[key].filter(o => o.currentProcess.status === 'rework').length
      };
    }

    success(res, {
      groups: grouped,
      summary,
      totalOrders: orders.length
    });
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
  getOrderNotifications,
  markOrderNotificationsAsRead,
  batchShipOrders,
  previewBatchShip,
  confirmBatchShip,
  requestBalancePayment,
  registerRefund,
  getProductionBoard
};
