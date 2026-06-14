const { User, Store } = require('../models');
const { success, error } = require('../utils/response');
const { generateToken } = require('../utils/jwt');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return error(res, '用户名和密码不能为空', 400);
    }

    const user = await User.findOne({
      where: { username },
      include: [{ model: Store, as: 'store' }]
    });

    if (!user) {
      return error(res, '用户不存在', 404);
    }

    if (user.status !== 'active') {
      return error(res, '用户已被禁用', 403);
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return error(res, '密码错误', 401);
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
      type: 'staff'
    });

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        phone: user.phone,
        email: user.email,
        storeId: user.storeId,
        avatar: user.avatar,
        store: user.store
      }
    }, '登录成功');
  } catch (err) {
    next(err);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return error(res, '未登录', 401);
    }

    const userData = await User.findByPk(user.id, {
      include: [{ model: Store, as: 'store' }],
      attributes: { exclude: ['password', 'deletedAt'] }
    });

    success(res, userData);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return error(res, '旧密码和新密码不能为空', 400);
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return error(res, '用户不存在', 404);
    }

    const isValid = await user.validatePassword(oldPassword);
    if (!isValid) {
      return error(res, '旧密码错误', 400);
    }

    await user.update({ password: newPassword });

    success(res, null, '密码修改成功');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getCurrentUser,
  changePassword
};
