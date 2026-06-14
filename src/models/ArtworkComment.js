const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ArtworkComment = sequelize.define('ArtworkComment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  artworkId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'artwork_id'
  },
  versionId: {
    type: DataTypes.INTEGER,
    field: 'version_id'
  },
  commentType: {
    type: DataTypes.ENUM('general', 'annotation', 'revision_request'),
    defaultValue: 'general',
    field: 'comment_type'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  position: {
    type: DataTypes.JSON
  },
  attachments: {
    type: DataTypes.JSON
  },
  commenterId: {
    type: DataTypes.INTEGER,
    field: 'commenter_id'
  },
  commenterType: {
    type: DataTypes.ENUM('customer', 'staff'),
    defaultValue: 'staff',
    field: 'commenter_type'
  },
  commenterName: {
    type: DataTypes.STRING(50),
    field: 'commenter_name'
  },
  isResolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_resolved'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    field: 'resolved_at'
  }
}, {
  tableName: 'artwork_comments'
});

module.exports = ArtworkComment;
