const moment = require('moment');

function generateNo(prefix) {
  const dateStr = moment().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${dateStr}${random}`;
}

function generateCustomerNo() {
  return generateNo('C');
}

function generateOrderNo() {
  return generateNo('O');
}

function generateQuoteNo() {
  return generateNo('Q');
}

function generateArtworkNo() {
  return generateNo('A');
}

function generatePaymentNo() {
  return generateNo('P');
}

function generateSettlementNo() {
  return generateNo('S');
}

module.exports = {
  generateNo,
  generateCustomerNo,
  generateOrderNo,
  generateQuoteNo,
  generateArtworkNo,
  generatePaymentNo,
  generateSettlementNo
};
