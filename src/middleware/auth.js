const { error } = require('../utils/response');
const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return error(res, '未提供认证令牌', 401);
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return error(res, '认证令牌无效或已过期', 401);
  }

  try {
    if (decoded.type === 'staff') {
      const user = await User.findByPk(decoded.id);
      if (!user || user.status !== 'active') {
        return error(res, '用户不存在或已禁用', 401);
      }
      req.user = user;
      req.userType = 'staff';
    } else if (decoded.type === 'customer') {
      req.customerId = decoded.id;
      req.userType = 'customer';
    }
    next();
  } catch (err) {
    console.error('Auth error:', err);
    error(res, '认证失败', 401);
  }
}

function staffAuth(req, res, next) {
  if (req.userType !== 'staff') {
    return error(res, '需要员工权限', 403);
  }
  next();
}

function adminAuth(req, res, next) {
  if (req.userType !== 'staff' || req.user.role !== 'admin') {
    return error(res, '需要管理员权限', 403);
  }
  next();
}

function customerAuth(req, res, next) {
  if (req.userType !== 'customer') {
    return error(res, '需要客户权限', 403);
  }
  next();
}

module.exports = {
  authMiddleware,
  staffAuth,
  adminAuth,
  customerAuth
};
