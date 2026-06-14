const { Op } = require('sequelize');
const { Quote, PaperSpec, ProcessSpec, Customer, Artwork } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { generateQuoteNo } = require('../utils/generator');

function calculateQuote(paperSpec, processList, quantity, customer) {
  let paperPrice = 0;
  if (paperSpec && paperSpec.pricePerUnit) {
    const sheetsNeeded = Math.ceil(quantity / 16);
    paperPrice = parseFloat(paperSpec.pricePerUnit) * sheetsNeeded;
  }

  let processPrice = 0;
  if (processList && Array.isArray(processList)) {
    processList.forEach(proc => {
      if (proc.price) {
        processPrice += parseFloat(proc.price) * (proc.quantity || 1);
      } else if (proc.basePrice) {
        processPrice += parseFloat(proc.basePrice);
      }
    });
  }

  const basePrice = paperPrice + processPrice;
  const otherPrice = 0;
  let totalPrice = basePrice + otherPrice;

  let discount = 0;
  if (customer && customer.discountRate) {
    const rate = parseFloat(customer.discountRate) / 100;
    discount = totalPrice * (1 - rate);
    totalPrice = totalPrice * rate;
  }

  return {
    paperPrice: parseFloat(paperPrice.toFixed(2)),
    processPrice: parseFloat(processPrice.toFixed(2)),
    basePrice: parseFloat(basePrice.toFixed(2)),
    otherPrice: parseFloat(otherPrice.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    totalPrice: parseFloat(totalPrice.toFixed(2))
  };
}

async function calculateQuotePrice(req, res, next) {
  try {
    const { paperSpecId, processIds, processList, quantity = 1, customerId } = req.body;

    let paperSpec = null;
    if (paperSpecId) {
      paperSpec = await PaperSpec.findByPk(paperSpecId);
    }

    let processes = processList || [];
    if (processIds && processIds.length > 0 && processes.length === 0) {
      const procSpecs = await ProcessSpec.findAll({
        where: { id: { [Op.in]: processIds } }
      });
      processes = procSpecs.map(p => ({
        id: p.id,
        name: p.name,
        basePrice: p.basePrice
      }));
    }

    let customer = null;
    if (customerId) {
      customer = await Customer.findByPk(customerId);
    }

    const result = calculateQuote(paperSpec, processes, quantity, customer);

    success(res, {
      ...result,
      paperSpec,
      processList: processes,
      quantity
    });
  } catch (err) {
    next(err);
  }
}

async function createQuote(req, res, next) {
  try {
    const {
      customerId, artworkId, title, paperSpecId,
      quantity = 1, size, processList, days = 3,
      remark, validDays = 7
    } = req.body;

    if (!customerId) {
      return error(res, '客户ID不能为空', 400);
    }

    let paperSpec = null;
    let paperSpecDetail = null;
    if (paperSpecId) {
      paperSpec = await PaperSpec.findByPk(paperSpecId);
      paperSpecDetail = paperSpec ? paperSpec.toJSON() : null;
    }

    let customer = await Customer.findByPk(customerId);

    const prices = calculateQuote(paperSpec, processList, quantity, customer);

    const quoteNo = generateQuoteNo();
    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + validDays);

    const quote = await Quote.create({
      quoteNo,
      customerId,
      artworkId,
      title,
      paperSpecId,
      paperSpecDetail,
      quantity,
      size,
      processList,
      basePrice: prices.basePrice,
      paperPrice: prices.paperPrice,
      processPrice: prices.processPrice,
      otherPrice: prices.otherPrice,
      discount: prices.discount,
      totalPrice: prices.totalPrice,
      manualAdjustment: 0,
      days,
      validDays,
      expiredAt,
      remark,
      status: 'pending',
      createdBy: req.user?.id || null,
      creatorType: req.userType === 'staff' ? 'staff' : 'customer'
    });

    success(res, quote, '报价单创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getQuoteList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      customerId
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
        { quoteNo: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    const { count, rows } = await Quote.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'customerNo', 'name'] },
        { model: Artwork, as: 'artwork', attributes: ['id', 'artworkNo', 'title'] }
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

async function getQuoteDetail(req, res, next) {
  try {
    const { id } = req.params;

    const quote = await Quote.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Artwork, as: 'artwork' },
        { model: PaperSpec, as: 'paperSpec' }
      ]
    });

    if (!quote) {
      return error(res, '报价单不存在', 404);
    }

    success(res, quote);
  } catch (err) {
    next(err);
  }
}

async function adjustQuotePrice(req, res, next) {
  try {
    const { id } = req.params;
    const { manualAdjustment, adjustRemark, newTotalPrice } = req.body;

    const quote = await Quote.findByPk(id);
    if (!quote) {
      return error(res, '报价单不存在', 404);
    }

    let adjustment = 0;
    if (newTotalPrice !== undefined) {
      adjustment = parseFloat(newTotalPrice) - parseFloat(quote.totalPrice);
    } else if (manualAdjustment !== undefined) {
      adjustment = parseFloat(manualAdjustment);
    }

    const newTotal = parseFloat(quote.totalPrice) + adjustment;

    await quote.update({
      manualAdjustment: adjustment,
      totalPrice: parseFloat(newTotal.toFixed(2)),
      adjustedBy: req.user?.id || null,
      adjustRemark: adjustRemark || ''
    });

    success(res, quote, '报价调整成功');
  } catch (err) {
    next(err);
  }
}

async function confirmQuote(req, res, next) {
  try {
    const { id } = req.params;

    const quote = await Quote.findByPk(id);
    if (!quote) {
      return error(res, '报价单不存在', 404);
    }

    if (quote.status !== 'pending') {
      return error(res, '报价单状态不允许确认', 400);
    }

    await quote.update({
      status: 'confirmed',
      confirmedAt: new Date()
    });

    success(res, quote, '报价已确认');
  } catch (err) {
    next(err);
  }
}

async function rejectQuote(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const quote = await Quote.findByPk(id);
    if (!quote) {
      return error(res, '报价单不存在', 404);
    }

    await quote.update({
      status: 'rejected',
      remark: reason || quote.remark
    });

    success(res, quote, '报价已拒绝');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  calculateQuotePrice,
  createQuote,
  getQuoteList,
  getQuoteDetail,
  adjustQuotePrice,
  confirmQuote,
  rejectQuote
};
