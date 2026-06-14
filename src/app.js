const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const db = require('./models');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { ensureUploadDir } = require('./middleware/upload');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const artworkRoutes = require('./routes/artworkRoutes');
const specRoutes = require('./routes/specRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settlementRoutes = require('./routes/settlementRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(config.upload.dir));

app.get('/api/health', (req, res) => {
  res.json({
    code: 200,
    message: 'ok',
    data: {
      name: '创意设计平台后端服务',
      version: '1.0.0',
      status: 'running',
      timestamp: Date.now()
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/specs', specRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/finance', settlementRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

ensureUploadDir();

const PORT = config.port;

db.sequelize.sync({ alter: false }).then(() => {
  console.log('数据库连接成功');
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log(`上传目录: ${config.upload.dir}`);
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
});

module.exports = app;
