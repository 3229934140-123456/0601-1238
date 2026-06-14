const { error } = require('../utils/response');

function notFoundHandler(req, res) {
  error(res, `接口不存在: ${req.method} ${req.path}`, 404);
}

function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message).join(', ');
    return error(res, `数据验证失败: ${messages}`, 400);
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return error(res, '数据已存在，违反唯一约束', 409);
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return error(res, '关联数据不存在', 400);
  }

  if (err.status) {
    return error(res, err.message || '请求错误', err.status);
  }

  error(res, err.message || '服务器内部错误', 500);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
