const { Op } = require('sequelize');
const { Artwork, ArtworkVersion, ArtworkComment, Customer } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { generateArtworkNo } = require('../utils/generator');
const path = require('path');
const fs = require('fs');

function checkArtworkOwnership(req, artwork) {
  if (req.userType === 'customer' && artwork.customerId !== req.customerId) {
    return false;
  }
  return true;
}

async function createArtwork(req, res, next) {
  try {
    const { title, description, category, tags } = req.body;
    let customerId;
    if (req.userType === 'customer') {
      customerId = req.customerId;
    } else {
      customerId = req.body.customerId;
    }

    if (!title) {
      return error(res, '作品标题不能为空', 400);
    }

    if (!customerId) {
      return error(res, '客户ID不能为空', 400);
    }

    const artworkNo = generateArtworkNo();

    const artwork = await Artwork.create({
      artworkNo,
      customerId,
      title,
      description,
      category,
      tags,
      createdBy: req.user?.id || null,
      status: 'draft'
    });

    success(res, artwork, '作品创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function uploadArtworkVersion(req, res, next) {
  try {
    const paramArtworkId = req.params.artworkId;
    const bodyArtworkId = req.body.artworkId;
    const artworkId = paramArtworkId || bodyArtworkId;
    const { remark } = req.body;

    if (!req.file) {
      return error(res, '请上传文件', 400);
    }

    let artwork;
    if (artworkId) {
      artwork = await Artwork.findByPk(artworkId);
      if (!artwork) {
        return error(res, '作品不存在', 404);
      }
      if (!checkArtworkOwnership(req, artwork)) {
        return error(res, '无权操作此作品', 403);
      }
    } else {
      let customerId;
      if (req.userType === 'customer') {
        customerId = req.customerId;
      } else {
        customerId = req.body.customerId;
      }
      if (!customerId) {
        return error(res, '客户ID不能为空', 400);
      }
      const artworkNo = generateArtworkNo();
      artwork = await Artwork.create({
        artworkNo,
        customerId,
        title: req.body.title || path.parse(req.file.originalname).name,
        description: req.body.description || '',
        category: req.body.category,
        createdBy: req.user?.id || null,
        status: 'submitted'
      });
    }

    const currentVersion = artwork.currentVersion || 0;
    const newVersion = currentVersion + 1;

    const version = await ArtworkVersion.create({
      artworkId: artwork.id,
      version: newVersion,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      remark,
      uploadedBy: req.user?.id || req.customerId || null,
      uploaderType: req.userType === 'staff' ? 'staff' : 'customer'
    });

    await artwork.update({
      currentVersion: newVersion,
      status: artwork.status === 'draft' ? 'submitted' : artwork.status
    });

    success(res, { artwork, version }, '文件上传成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getArtworkList(req, res, next) {
  try {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      category,
      customerId
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
        { artworkNo: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    const { count, rows } = await Artwork.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'customerNo', 'name', 'contact', 'phone'] }
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

async function getArtworkDetail(req, res, next) {
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
      return error(res, '作品不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权访问此作品', 403);
    }

    success(res, artwork);
  } catch (err) {
    next(err);
  }
}

async function updateArtwork(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, category, tags, status } = req.body;

    const artwork = await Artwork.findByPk(id);
    if (!artwork) {
      return error(res, '作品不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权操作此作品', 403);
    }

    await artwork.update({ title, description, category, tags, status });

    success(res, artwork, '作品信息更新成功');
  } catch (err) {
    next(err);
  }
}

async function deleteArtwork(req, res, next) {
  try {
    const { id } = req.params;

    const artwork = await Artwork.findByPk(id);
    if (!artwork) {
      return error(res, '作品不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权操作此作品', 403);
    }

    await artwork.destroy();

    success(res, null, '作品删除成功');
  } catch (err) {
    next(err);
  }
}

async function getArtworkVersions(req, res, next) {
  try {
    const { artworkId } = req.params;

    const artwork = await Artwork.findByPk(artworkId);
    if (!artwork) {
      return error(res, '作品不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权访问此作品', 403);
    }

    const versions = await ArtworkVersion.findAll({
      where: { artworkId },
      order: [['version', 'DESC']]
    });

    success(res, versions);
  } catch (err) {
    next(err);
  }
}

async function addArtworkComment(req, res, next) {
  try {
    const { artworkId } = req.params;
    const { content, commentType = 'general', position, versionId } = req.body;

    if (!content) {
      return error(res, '评论内容不能为空', 400);
    }

    const artwork = await Artwork.findByPk(artworkId);
    if (!artwork) {
      return error(res, '作品不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权操作此作品', 403);
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

    success(res, comment, '评论添加成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getArtworkComments(req, res, next) {
  try {
    const { artworkId } = req.params;
    const { versionId } = req.query;

    const artwork = await Artwork.findByPk(artworkId);
    if (!artwork) {
      return error(res, '作品不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权访问此作品', 403);
    }

    const where = { artworkId };
    if (versionId) {
      where.versionId = versionId;
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

async function resolveComment(req, res, next) {
  try {
    const { commentId } = req.params;

    const comment = await ArtworkComment.findByPk(commentId);
    if (!comment) {
      return error(res, '评论不存在', 404);
    }

    await comment.update({
      isResolved: true,
      resolvedAt: new Date()
    });

    success(res, comment, '评论已标记为已解决');
  } catch (err) {
    next(err);
  }
}

async function submitForReview(req, res, next) {
  try {
    const { id } = req.params;

    const artwork = await Artwork.findByPk(id);
    if (!artwork) {
      return error(res, '作品不存在', 404);
    }

    if (!checkArtworkOwnership(req, artwork)) {
      return error(res, '无权操作此作品', 403);
    }

    await artwork.update({ status: 'reviewing' });

    success(res, artwork, '已提交审核');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createArtwork,
  uploadArtworkVersion,
  getArtworkList,
  getArtworkDetail,
  updateArtwork,
  deleteArtwork,
  getArtworkVersions,
  addArtworkComment,
  getArtworkComments,
  resolveComment,
  submitForReview
};
