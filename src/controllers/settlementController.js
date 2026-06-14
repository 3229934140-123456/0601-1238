const { Op, fn, col } = require('sequelize');
const {
  Settlement, Order, Customer, Review, Payment
} = require('../models');
const { success, error, paginate } = require('../utils/response');
const { generateSettlementNo } = require('../utils/generator');
const moment = require('moment');

async function generateSettlement(req, res, next) {
  try {
    const { customerId, period } = req.body;

    if (!customerId || !period) {
      return error(res, '客户ID和账期不能为空', 400);
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return error(res, '客户不存在', 404);
    }

    const periodStart = moment(period + '-01').startOf('month').toDate();
    const periodEnd = moment(period + '-01').endOf('month').toDate();

    const existing = await Settlement.findOne({
      where: { customerId, period }
    });

    if (existing) {
      return error(res, '该账期已存在对账单', 409);
    }

    const orders = await Order.findAll({
      where: {
        customerId,
        createdAt: {
          [Op.between]: [periodStart, periodEnd]
        },
        status: { [Op.notIn]: ['cancelled', 'refunded'] }
      }
    });

    const orderIds = orders.map(o => o.id);
    const orderCount = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.actualAmount || 0), 0);

    const payments = await Payment.findAll({
      where: {
        customerId,
        confirmedAt: {
          [Op.between]: [periodStart, periodEnd]
        },
        status: 'confirmed'
      }
    });

    const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const refundAmount = 0;
    const unpaidAmount = totalAmount - paidAmount - refundAmount;

    const settlementNo = generateSettlementNo();

    const settlement = await Settlement.create({
      settlementNo,
      customerId,
      period,
      periodStart,
      periodEnd,
      orderCount,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      paidAmount: parseFloat(paidAmount.toFixed(2)),
      unpaidAmount: parseFloat(unpaidAmount.toFixed(2)),
      refundAmount: parseFloat(refundAmount.toFixed(2)),
      status: 'draft',
      orderIds
    });

    success(res, settlement, '对账单生成成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getSettlementList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 10,
      customerId,
      status,
      period
    } = req.query;

    const where = {};

    if (req.customerId) {
      where.customerId = req.customerId;
    } else if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (period) {
      where.period = period;
    }

    const { count, rows } = await Settlement.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'customerNo', 'name'] }
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

async function getSettlementDetail(req, res, next) {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' }
      ]
    });

    if (!settlement) {
      return error(res, '对账单不存在', 404);
    }

    let orders = [];
    if (settlement.orderIds && settlement.orderIds.length > 0) {
      orders = await Order.findAll({
        where: { id: { [Op.in]: settlement.orderIds } },
        order: [['id', 'DESC']]
      });
    }

    success(res, { ...settlement.toJSON(), orders });
  } catch (err) {
    next(err);
  }
}

async function confirmSettlement(req, res, next) {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findByPk(id);
    if (!settlement) {
      return error(res, '对账单不存在', 404);
    }

    await settlement.update({
      status: 'confirmed',
      confirmedBy: req.user?.id,
      confirmedAt: new Date()
    });

    success(res, settlement, '对账单已确认');
  } catch (err) {
    next(err);
  }
}

async function customerConfirmSettlement(req, res, next) {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findByPk(id);
    if (!settlement) {
      return error(res, '对账单不存在', 404);
    }

    if (req.customerId && settlement.customerId !== req.customerId) {
      return error(res, '无权操作此对账单', 403);
    }

    await settlement.update({
      status: 'settled',
      customerConfirmedAt: new Date()
    });

    success(res, settlement, '客户已确认对账');
  } catch (err) {
    next(err);
  }
}

async function disputeSettlement(req, res, next) {
  try {
    const { id } = req.params;
    const { remark } = req.body;

    const settlement = await Settlement.findByPk(id);
    if (!settlement) {
      return error(res, '对账单不存在', 404);
    }

    await settlement.update({
      status: 'disputed',
      remark: remark || settlement.remark
    });

    success(res, settlement, '已标记为异议');
  } catch (err) {
    next(err);
  }
}

async function createReview(req, res, next) {
  try {
    const { orderId, qualityRating = 5, serviceRating = 5, deliveryRating = 5, content, images, isAnonymous = false } = req.body;

    if (!orderId) {
      return error(res, '订单ID不能为空', 400);
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (order.status !== 'delivered') {
      return error(res, '订单未交付，无法评价', 400);
    }

    const existing = await Review.findOne({ where: { orderId } });
    if (existing) {
      return error(res, '该订单已评价', 409);
    }

    const overallRating = ((parseInt(qualityRating) + parseInt(serviceRating) + parseInt(deliveryRating)) / 3).toFixed(1);

    const review = await Review.create({
      orderId,
      customerId: order.customerId,
      qualityRating,
      serviceRating,
      deliveryRating,
      overallRating,
      content,
      images,
      isAnonymous,
      status: 'approved'
    });

    success(res, review, '评价提交成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getReviewList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 10,
      customerId,
      orderId,
      status
    } = req.query;

    const where = {};

    if (req.customerId) {
      where.customerId = req.customerId;
    } else if (customerId) {
      where.customerId = customerId;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (status) {
      where.status = status;
    }

    const { count, rows } = await Review.findAndCountAll({
      where,
      include: [
        { model: Order, as: 'order', attributes: ['id', 'orderNo', 'title'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name'] }
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

async function getReviewDetail(req, res, next) {
  try {
    const { id } = req.params;

    const review = await Review.findByPk(id, {
      include: [
        { model: Order, as: 'order' },
        { model: Customer, as: 'customer' }
      ]
    });

    if (!review) {
      return error(res, '评价不存在', 404);
    }

    success(res, review);
  } catch (err) {
    next(err);
  }
}

async function replyReview(req, res, next) {
  try {
    const { id } = req.params;
    const { replyContent } = req.body;

    const review = await Review.findByPk(id);
    if (!review) {
      return error(res, '评价不存在', 404);
    }

    await review.update({
      replyContent,
      repliedAt: new Date(),
      repliedBy: req.user?.id
    });

    success(res, review, '回复成功');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateSettlement,
  getSettlementList,
  getSettlementDetail,
  confirmSettlement,
  customerConfirmSettlement,
  disputeSettlement,
  createReview,
  getReviewList,
  getReviewDetail,
  replyReview
};
