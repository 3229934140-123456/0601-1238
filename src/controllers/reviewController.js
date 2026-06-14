const { Op } = require('sequelize');
const {
  Artwork, ArtworkComment, ArtworkVersion,
  Order, OrderStatusLog, Customer
} = require('../models');
const { success, error, paginate } = require('../utils/response');
const { createNotification } = require('../utils/notification');

function checkArtworkOwnership(req, artwork) {
  if (req.userType === 'customer' && artwork.customerId !== req.customerId) {
    return false;
  }
  return true;
}

function checkOrderOwnership(req, order) {
  if (req.userType === 'customer' && order.customerId !== req.customerId) {
    return false;
  }
  return true;
}

async function getReviewList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 10,
      status,
      customerId,
      keyword
    } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.in]: ['submitted', 'reviewing', 'revision'] };
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { artworkNo: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await Artwork.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'customerNo', 'name', 'contact', 'phone'] }
      ],
      order: [['updatedAt', 'DESC']],
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

    const artwork = await Artwork.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' },
        {
          model: ArtworkVersion,
          as: 'versions',
          order: [['version', 'DESC']]
        },
        {
          model: ArtworkComment,
          as: 'comments',
          order: [['id', 'DESC']]
        }
      ]
    });

    if (!artwork) {
      return error(res, '稿件不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权访问此稿件', 403);
    }

    success(res, artwork);
  } catch (err) {
    next(err);
  }
}

async function addReviewComment(req, res, next) {
  try {
    const { artworkId } = req.params;
    const { content, commentType = 'general', position, versionId } = req.body;

    if (!content) {
      return error(res, '评论内容不能为空', 400);
    }

    const artwork = await Artwork.findByPk(artworkId);
    if (!artwork) {
      return error(res, '稿件不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权操作此稿件', 403);
    }

    const comment = await ArtworkComment.create({
      artworkId,
      versionId,
      commentType,
      content,
      position,
      commenterId: req.user?.id || req.customerId || null,
      commenterType: req.userType === 'staff' ? 'staff' : 'customer',
      commenterName: req.user?.realName || req.user?.username || '客户'
    });

    if (req.userType === 'staff') {
      await createNotification({
        recipientId: artwork.customerId,
        recipientType: 'customer',
        type: 'artwork',
        title: '稿件有新的审稿意见',
        content: `您的稿件「${artwork.title}」有新的审稿意见，请查看。`,
        relatedType: 'artwork',
        relatedId: artwork.id,
        level: 'important'
      });
    }

    success(res, comment, '评论添加成功', 201);
  } catch (err) {
    next(err);
  }
}

async function returnForRevision(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const artwork = await Artwork.findByPk(id);
    if (!artwork) {
      return error(res, '稿件不存在', 404);
    }

    await artwork.update({ status: 'revision' });

    if (reason) {
      await ArtworkComment.create({
        artworkId: id,
        commentType: 'revision_request',
        content: reason,
        commenterId: req.user?.id,
        commenterType: 'staff',
        commenterName: req.user?.realName || '审稿员'
      });
    }

    await createNotification({
      recipientId: artwork.customerId,
      recipientType: 'customer',
      type: 'artwork',
      title: '稿件需要修改',
      content: `您的稿件「${artwork.title}」需要修改：${reason || '请查看审稿意见'}`,
      relatedType: 'artwork',
      relatedId: artwork.id,
      level: 'important'
    });

    success(res, artwork, '已退回修改');
  } catch (err) {
    next(err);
  }
}

async function approveArtwork(req, res, next) {
  try {
    const { id } = req.params;
    const { remark } = req.body;

    const artwork = await Artwork.findByPk(id);
    if (!artwork) {
      return error(res, '稿件不存在', 404);
    }

    await artwork.update({ status: 'approved' });

    await createNotification({
      recipientId: artwork.customerId,
      recipientType: 'customer',
      type: 'artwork',
      title: '稿件审核通过',
      content: `您的稿件「${artwork.title}」已审核通过。`,
      relatedType: 'artwork',
      relatedId: artwork.id,
      level: 'important'
    });

    success(res, artwork, '稿件审核通过');
  } catch (err) {
    next(err);
  }
}

async function startProofing(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    await order.update({
      proofStatus: 'pending_approval',
      status: 'proofing'
    });

    await OrderStatusLog.create({
      orderId,
      fromStatus: 'in_production',
      toStatus: 'proofing',
      remark: '开始打样',
      operatorId: req.user?.id,
      operatorType: 'staff',
      operatorName: req.user?.realName || '系统'
    });

    await createNotification({
      recipientId: order.customerId,
      recipientType: 'customer',
      type: 'order',
      title: '订单进入打样阶段',
      content: `您的订单「${order.title}」已进入打样阶段，请等待打样确认。`,
      relatedType: 'order',
      relatedId: order.id,
      level: 'important'
    });

    success(res, order, '已开始打样');
  } catch (err) {
    next(err);
  }
}

async function approveProof(req, res, next) {
  try {
    const { orderId } = req.params;
    const { remark } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权操作此订单', 403);
    }

    if (order.proofStatus !== 'pending_approval') {
      return error(res, '当前状态不允许确认打样', 400);
    }

    await order.update({
      proofStatus: 'approved',
      status: 'producing'
    });

    await OrderStatusLog.create({
      orderId,
      fromStatus: 'proofing',
      toStatus: 'producing',
      remark: remark || '客户确认打样，开始量产',
      operatorId: req.customerId || req.user?.id,
      operatorType: req.userType === 'staff' ? 'staff' : 'customer',
      operatorName: req.user?.realName || '客户'
    });

    success(res, order, '打样已确认，开始量产');
  } catch (err) {
    next(err);
  }
}

async function rejectProof(req, res, next) {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return error(res, '订单不存在', 404);
    }

    if (!checkOrderOwnership(req, order)) {
      return error(res, '无权操作此订单', 403);
    }

    if (order.proofStatus !== 'pending_approval') {
      return error(res, '当前打样状态不允许拒绝', 400);
    }

    await order.update({
      proofStatus: 'rejected'
    });

    await OrderStatusLog.create({
      orderId,
      fromStatus: 'proofing',
      toStatus: 'proofing',
      remark: `打样被拒绝${reason ? `，原因：${reason}` : '（原因未填写）'}`,
      operatorId: req.customerId || req.user?.id,
      operatorType: req.userType === 'staff' ? 'staff' : 'customer',
      operatorName: req.user?.realName || '客户'
    });

    const { createNotification } = require('../utils/notification');
    await createNotification({
      recipientId: order.assignedTo || order.confirmedBy || 1,
      recipientType: 'staff',
      type: 'review',
      title: '打样被客户拒绝',
      content: `订单「${order.title}」的打样被客户拒绝${reason ? `，原因：${reason}` : ''}`,
      relatedType: 'order',
      relatedId: order.id,
      level: 'important',
      senderName: req.user?.realName || '客户'
    });

    success(res, {
      ...order.toJSON(),
      proofRejected: true,
      rejectReason: reason || ''
    }, '打样已拒绝');
  } catch (err) {
    next(err);
  }
}

async function getReviewComments(req, res, next) {
  try {
    const { artworkId } = req.params;
    const { commentType } = req.query;

    const artwork = await Artwork.findByPk(artworkId);
    if (!artwork) {
      return error(res, '稿件不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权访问此稿件', 403);
    }

    const where = { artworkId };
    if (commentType) {
      where.commentType = commentType;
    }

    const comments = await ArtworkComment.findAll({
      where,
      order: [['id', 'DESC']]
    });

    success(res, comments);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReviewList,
  getReviewDetail,
  addReviewComment,
  returnForRevision,
  approveArtwork,
  startProofing,
  approveProof,
  rejectProof,
  getReviewComments
};
