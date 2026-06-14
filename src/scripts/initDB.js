const db = require('../models');
const { PaperSpec, ProcessSpec, User, Store, Customer } = db;

async function initDB() {
  console.log('开始初始化数据库...');

  await db.sequelize.sync({ force: true });
  console.log('数据库表创建完成');

  const store1 = await Store.create({
    storeNo: 'S001',
    name: '总店',
    address: '北京市朝阳区建国路88号',
    phone: '010-88888888',
    type: 'comprehensive',
    businessHours: '9:00-18:00',
    description: '旗舰店'
  });

  const store2 = await Store.create({
    storeNo: 'S002',
    name: '海淀分店',
    address: '北京市海淀区中关村大街1号',
    phone: '010-66666666',
    type: 'reception',
    businessHours: '9:00-18:00',
    description: '海淀门店'
  });

  console.log('门店数据创建完成');

  const admin = await User.create({
    username: 'admin',
    password: '123456',
    realName: '系统管理员',
    role: 'admin',
    phone: '13800000000',
    email: 'admin@example.com',
    storeId: store1.id
  });

  await User.create({
    username: 'sales01',
    password: '123456',
    realName: '张销售',
    role: 'sales',
    phone: '13800000001',
    email: 'sales01@example.com',
    storeId: store1.id
  });

  await User.create({
    username: 'reviewer01',
    password: '123456',
    realName: '李审稿',
    role: 'reviewer',
    phone: '13800000002',
    email: 'reviewer01@example.com',
    storeId: store1.id
  });

  await User.create({
    username: 'manager01',
    password: '123456',
    realName: '王经理',
    role: 'store_manager',
    phone: '13800000003',
    email: 'manager@example.com',
    storeId: store2.id
  });

  console.log('用户数据创建完成');

  const paperSpecs = [
    { name: '铜版纸 157g A4', category: '铜版纸', size: 'A4', width: 210, height: 297, thickness: '0.15mm', weight: 157, pricePerUnit: 0.8, priceUnit: 'sheet', color: '白色', material: '铜版纸', sort: 1 },
    { name: '铜版纸 200g A4', category: '铜版纸', size: 'A4', width: 210, height: 297, thickness: '0.18mm', weight: 200, pricePerUnit: 1.2, priceUnit: 'sheet', color: '白色', material: '铜版纸', sort: 2 },
    { name: '铜版纸 250g A3', category: '铜版纸', size: 'A3', width: 297, height: 420, thickness: '0.22mm', weight: 250, pricePerUnit: 2.5, priceUnit: 'sheet', color: '白色', material: '铜版纸', sort: 3 },
    { name: '哑粉纸 200g A4', category: '哑粉纸', size: 'A4', width: 210, height: 297, thickness: '0.18mm', weight: 200, pricePerUnit: 1.5, priceUnit: 'sheet', color: '白色', material: '哑粉纸', sort: 4 },
    { name: '双胶纸 80g A4', category: '双胶纸', size: 'A4', width: 210, height: 297, thickness: '0.09mm', weight: 80, pricePerUnit: 0.15, priceUnit: 'sheet', color: '白色', material: '双胶纸', sort: 5 },
    { name: '牛皮纸 250g A4', category: '牛皮纸', size: 'A4', width: 210, height: 297, thickness: '0.23mm', weight: 250, pricePerUnit: 1.8, priceUnit: 'sheet', color: '牛皮色', material: '牛皮纸', sort: 6 },
    { name: '白卡纸 300g A4', category: '白卡纸', size: 'A4', width: 210, height: 297, thickness: '0.35mm', weight: 300, pricePerUnit: 2.0, priceUnit: 'sheet', color: '白色', material: '白卡纸', sort: 7 },
    { name: '特种纸 冰白 A4', category: '特种纸', size: 'A4', width: 210, height: 297, thickness: '0.3mm', weight: 250, pricePerUnit: 3.5, priceUnit: 'sheet', color: '冰白', material: '特种纸', sort: 8 }
  ];

  await PaperSpec.bulkCreate(paperSpecs);
  console.log('纸张规格数据创建完成');

  const processSpecs = [
    { name: '彩色印刷', category: '印刷', type: 'printing', basePrice: 50, priceUnit: 'item', description: 'CMYK四色印刷', sort: 1 },
    { name: '黑白印刷', category: '印刷', type: 'printing', basePrice: 20, priceUnit: 'item', description: '单黑印刷', sort: 2 },
    { name: '覆膜（光膜）', category: '印后', type: 'postpress', basePrice: 0.5, priceUnit: 'sheet', unitType: '面', description: '光膜覆膜', sort: 3 },
    { name: '覆膜（哑膜）', category: '印后', type: 'postpress', basePrice: 0.6, priceUnit: 'sheet', unitType: '面', description: '哑膜覆膜', sort: 4 },
    { name: '烫金', category: '特殊工艺', type: 'special', basePrice: 30, priceUnit: 'item', description: '烫金工艺', sort: 5 },
    { name: '烫银', category: '特殊工艺', type: 'special', basePrice: 30, priceUnit: 'item', description: '烫银工艺', sort: 6 },
    { name: 'UV', category: '特殊工艺', type: 'special', basePrice: 25, priceUnit: 'item', description: '局部UV', sort: 7 },
    { name: '压纹', category: '特殊工艺', type: 'special', basePrice: 20, priceUnit: 'item', description: '压纹工艺', sort: 8 },
    { name: '模切', category: '印后', type: 'postpress', basePrice: 40, priceUnit: 'item', description: '异形模切', sort: 9 },
    { name: '装订（胶装）', category: '印后', type: 'postpress', basePrice: 15, priceUnit: 'book', unitType: '本', description: '胶装装订', sort: 10 },
    { name: '装订（骑马订）', category: '印后', type: 'postpress', basePrice: 5, priceUnit: 'book', unitType: '本', description: '骑马订装订', sort: 11 },
    { name: '打码', category: '印后', type: 'postpress', basePrice: 0.1, priceUnit: 'sheet', unitType: '张', description: '号码打码', sort: 12 }
  ];

  await ProcessSpec.bulkCreate(processSpecs);
  console.log('工艺规格数据创建完成');

  const customer1 = await Customer.create({
    customerNo: 'C2024010001',
    name: '北京科技有限公司',
    contact: '刘经理',
    phone: '13900000001',
    email: 'liu@tech.com',
    address: '北京市海淀区科技园A座',
    company: '北京科技有限公司',
    level: 'gold',
    discountRate: 90,
    creditLimit: 50000,
    source: '线上',
    remark: '重要客户，月结',
    salesUserId: admin.id,
    totalOrders: 0,
    totalAmount: 0
  });

  const customer2 = await Customer.create({
    customerNo: 'C2024010002',
    name: '创意广告工作室',
    contact: '陈设计',
    phone: '13900000002',
    email: 'chen@creative.com',
    address: '北京市朝阳区创意园B座',
    company: '创意广告工作室',
    level: 'silver',
    discountRate: 95,
    creditLimit: 20000,
    source: '朋友介绍',
    remark: '设计公司，订单量大',
    salesUserId: admin.id,
    totalOrders: 0,
    totalAmount: 0
  });

  const customer3 = await Customer.create({
    customerNo: 'C2024010003',
    name: '张小明',
    contact: '张小明',
    phone: '13900000003',
    email: 'zhangxm@example.com',
    address: '北京市西城区xx街',
    company: '',
    level: 'normal',
    discountRate: 100,
    creditLimit: 0,
    source: '门店',
    remark: '散客',
    salesUserId: admin.id,
    totalOrders: 0,
    totalAmount: 0
  });

  console.log('客户数据创建完成');

  console.log('\n========================================');
  console.log('数据库初始化完成!');
  console.log('========================================');
  console.log('管理员账号: admin / 123456');
  console.log('销售员账号: sales01 / 123456');
  console.log('审稿员账号: reviewer01 / 123456');
  console.log('门店经理账号: manager01 / 123456');
  console.log('');
  console.log('测试客户（手机号登录）:');
  console.log('  13900000001 - 北京科技有限公司 (金牌客户)');
  console.log('  13900000002 - 创意广告工作室 (银牌客户)');
  console.log('  13900000003 - 张小明 (普通客户)');
  console.log('========================================');

  process.exit(0);
}

initDB().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
