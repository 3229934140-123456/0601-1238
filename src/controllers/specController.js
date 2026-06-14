const { Op } = require('sequelize');
const { PaperSpec, ProcessSpec } = require('../models');
const { success, error, paginate } = require('../utils/response');

async function getPaperSpecList(req, res, next) {
  try {
    const { page = 1, pageSize = 20, keyword, category, status } = req.query;

    const where = {};

    if (keyword) {
      where.name = { [Op.like]: `%${keyword}%` };
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    } else {
      where.status = 'active';
    }

    const { count, rows } = await PaperSpec.findAndCountAll({
      where,
      order: [['sort', 'ASC'], ['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize)
    });

    success(res, paginate(rows, page, pageSize, count));
  } catch (err) {
    next(err);
  }
}

async function getPaperSpecDetail(req, res, next) {
  try {
    const { id } = req.params;

    const spec = await PaperSpec.findByPk(id);
    if (!spec) {
      return error(res, '纸张规格不存在', 404);
    }

    success(res, spec);
  } catch (err) {
    next(err);
  }
}

async function createPaperSpec(req, res, next) {
  try {
    const {
      name, category, size, width, height, unit = 'mm',
      thickness, weight, pricePerUnit, priceUnit = 'sheet',
      color, material, description, sort = 0
    } = req.body;

    if (!name) {
      return error(res, '规格名称不能为空', 400);
    }

    const spec = await PaperSpec.create({
      name, category, size, width, height, unit,
      thickness, weight, pricePerUnit, priceUnit,
      color, material, description, sort
    });

    success(res, spec, '纸张规格创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function updatePaperSpec(req, res, next) {
  try {
    const { id } = req.params;

    const spec = await PaperSpec.findByPk(id);
    if (!spec) {
      return error(res, '纸张规格不存在', 404);
    }

    await spec.update(req.body);

    success(res, spec, '纸张规格更新成功');
  } catch (err) {
    next(err);
  }
}

async function deletePaperSpec(req, res, next) {
  try {
    const { id } = req.params;

    const spec = await PaperSpec.findByPk(id);
    if (!spec) {
      return error(res, '纸张规格不存在', 404);
    }

    await spec.destroy();

    success(res, null, '纸张规格删除成功');
  } catch (err) {
    next(err);
  }
}

async function getProcessSpecList(req, res, next) {
  try {
    const { page = 1, pageSize = 20, keyword, category, type, status } = req.query;

    const where = {};

    if (keyword) {
      where.name = { [Op.like]: `%${keyword}%` };
    }

    if (category) {
      where.category = category;
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    } else {
      where.status = 'active';
    }

    const { count, rows } = await ProcessSpec.findAndCountAll({
      where,
      order: [['sort', 'ASC'], ['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize)
    });

    success(res, paginate(rows, page, pageSize, count));
  } catch (err) {
    next(err);
  }
}

async function getProcessSpecDetail(req, res, next) {
  try {
    const { id } = req.params;

    const spec = await ProcessSpec.findByPk(id);
    if (!spec) {
      return error(res, '工艺规格不存在', 404);
    }

    success(res, spec);
  } catch (err) {
    next(err);
  }
}

async function createProcessSpec(req, res, next) {
  try {
    const {
      name, category, type = 'printing', basePrice,
      priceUnit = 'item', unitType, description, options, sort = 0
    } = req.body;

    if (!name) {
      return error(res, '工艺名称不能为空', 400);
    }

    const spec = await ProcessSpec.create({
      name, category, type, basePrice,
      priceUnit, unitType, description, options, sort
    });

    success(res, spec, '工艺规格创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function updateProcessSpec(req, res, next) {
  try {
    const { id } = req.params;

    const spec = await ProcessSpec.findByPk(id);
    if (!spec) {
      return error(res, '工艺规格不存在', 404);
    }

    await spec.update(req.body);

    success(res, spec, '工艺规格更新成功');
  } catch (err) {
    next(err);
  }
}

async function deleteProcessSpec(req, res, next) {
  try {
    const { id } = req.params;

    const spec = await ProcessSpec.findByPk(id);
    if (!spec) {
      return error(res, '工艺规格不存在', 404);
    }

    await spec.destroy();

    success(res, null, '工艺规格删除成功');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaperSpecList,
  getPaperSpecDetail,
  createPaperSpec,
  updatePaperSpec,
  deletePaperSpec,
  getProcessSpecList,
  getProcessSpecDetail,
  createProcessSpec,
  updateProcessSpec,
  deleteProcessSpec
};
