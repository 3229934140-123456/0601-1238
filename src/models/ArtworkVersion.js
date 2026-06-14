const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ArtworkVersion = sequelize.define('ArtworkVersion', {
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
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  fileName: {
    type: DataTypes.STRING(255),
    field: 'file_name'
  },
  filePath: {
    type: DataTypes.STRING(500),
    field: 'file_path'
  },
  fileSize: {
    type: DataTypes.BIGINT,
    field: 'file_size'
  },
  fileType: {
    type: DataTypes.STRING(50),
    field: 'file_type'
  },
  thumbnail: {
    type: DataTypes.STRING(500)
  },
  remark: {
    type: DataTypes.TEXT
  },
  uploadedBy: {
    type: DataTypes.INTEGER,
    field: 'uploaded_by'
  },
  uploaderType: {
    type: DataTypes.ENUM('customer', 'staff'),
    defaultValue: 'customer',
    field: 'uploader_type'
  }
}, {
  tableName: 'artwork_versions'
});

module.exports = ArtworkVersion;
