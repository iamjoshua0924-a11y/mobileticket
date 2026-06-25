const crypto = require('crypto');

// 오타를 줄이기 위해 모호한 문자(O/0, I/1 등)를 제외한 알파벳 사용
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomToken(len) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    const idx = crypto.randomInt(0, ALPHABET.length);
    out += ALPHABET[idx];
  }
  return out;
}

function yyyymmdd(date = new Date()) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function makeBookingNo(date = new Date()) {
  return `GT-${yyyymmdd(date)}-${randomToken(6)}`;
}

module.exports = { makeBookingNo };

