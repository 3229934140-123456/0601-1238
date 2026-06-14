const { Op } = require('sequelize');
const { Customer, User } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { generateCustomerNo, generateToken } = require('../utils/generator');
const { generateToken: genJwtToken } = require('../utils/jwt');

async function createCustomer(req, res, next) {
  try {
    const {
      name, contact, phone, email, address, company,
      level = 'normal', source, remark, salesUserId
    } = req.body;

    if (!name) {
      return error(res, '客户名称不能为空', 400);
    }

    const customerNo = generateCustomerNo();

    const customer = await Customer.create({
      customerNo,
      name,
      contact,
      phone,
      email,
      address,
      company,
      level,
      source,
      remark,
      salesUserId: salesUserId || (req.user?.id)
    });

    success(res, customer, '客户创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getCustomerList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      level,
      salesUserId
    } = req.query;

    const where = {};

    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { customerNo: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
        { contact: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (level) {
      where.level = level;
    }

    if (salesUserId) {
      where.salesUserId = salesUserId;
    }

    const { count, rows } = await Customer.findAndCountAll({
      where,
      include: [
        { model: User, as: 'salesUser', attributes: ['id', 'realName', 'username'] }
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

async function getCustomerDetail(req, res, next) {
  try {
    const { id } = req.params;

    const customer = await Customer.findByPk(id, {
      include: [
        { model: User, as: 'salesUser', attributes: ['id', 'realName', 'username'] }
      ]
    });

    if (!customer) {
      return error(res, '客户不存在', 404);
    }

    success(res, customer);
  } catch (err) {
    next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const customer = await Customer.findByPk(id);
    if (!customer) {
      return error(res, '客户不存在', 404);
    }

    await customer.update(updateData);

    success(res, customer, '客户信息更新成功');
  } catch (err) {
    next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;

    const customer = await Customer.findByPk(id);
    if (!customer) {
      return error(res, '客户不存在', 404);
    }

    await customer.destroy();

    success(res, null, '客户删除成功');
  } catch (err) {
    next(err);
  }
}

async function customerLogin(req, res, next) {
  try {
    const { phone, customerNo } = req.body;

    let customer;
    if (phone) {
      customer = await Customer.findOne({ where: { phone } });
    } else if (customerNo) {
      customer = await Customer.findOne({ where: { customerNo } });
    }

    if (!customer) {
      return error(res, '客户不存在', 404);
    }

    if (customer.status !== 'active') {
      return error(res, '客户账号已被禁用', 403);
    }

    const token = genJwtToken({
      id: customer.id,
      type: 'customer',
      customerNo: customer.customerNo,
      name: customer.name
    });

    success(res, {
      token,
      customer: {
        id: customer.id,
        customerNo: customer.customerNo,
        name: customer.name,
        contact: customer.contact,
        phone: customer.phone,
        email: customer.email,
        level: customer.level
      }
    }, '登录成功');
  } catch (err) {
    next(err);
  }
}

async function getCustomerProfile(req, res, next) {
  try {
    const customerId = req.customerId;

    const customer = await Customer.findByPk(customerId, {
      attributes: { exclude: ['deletedAt'] }
    });

    if (!customer) {
      return error(res, '客户不存在', 404);
    }

    success(res, customer);
  } catch (err) {
    next(err);
  }
}

async function updateCustomerProfile(req, res, next) {
  try {
    const customerId = req.customerId;
    const { contact, phone, email, address, company } = req.body;

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return error(res, '客户不存在', 404);
    }

    await customer.update({ contact, phone, email, address, company });

    success(res, customer, '个人信息更新成功');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCustomer,
  getCustomerList,
  getCustomerDetail,
  updateCustomer,
  deleteCustomer,
  customerLogin,
  getCustomerProfile,
  updateCustomerProfile
};
