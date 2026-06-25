const express = require('express');
const Ticket = require('../models/Ticket');
const { staffAuth } = require('../middleware/staffAuth');
const { makeBookingNo } = require('../utils/bookingNo');

const router = express.Router();

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// 관객: 예매 생성
router.post('/', async (req, res) => {
  try {
    const { name, phone, headcount, depositorName } = req.body || {};
    const hc = Number(headcount);

    if (!name || !phone || !depositorName || !Number.isFinite(hc) || hc < 1) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    // bookingNo 충돌 시 재시도
    let bookingNo;
    for (let i = 0; i < 5; i += 1) {
      bookingNo = makeBookingNo();
      // eslint-disable-next-line no-await-in-loop
      const exists = await Ticket.exists({ bookingNo });
      if (!exists) break;
      bookingNo = null;
    }
    if (!bookingNo) return res.status(500).json({ message: 'Failed to generate booking number' });

    const ticket = await Ticket.create({
      bookingNo,
      name,
      phone,
      headcount: hc,
      depositorName
    });

    return res.status(201).json({ ticket });
  } catch (err) {
    // unique 충돌 등
    return res.status(500).json({ message: 'Server error' });
  }
});

// 관객: 예매번호로 조회(재확인)
router.get('/by-booking/:bookingNo', async (req, res) => {
  const { bookingNo } = req.params;
  const ticket = await Ticket.findOne({ bookingNo }).lean();
  if (!ticket) return res.status(404).json({ message: 'Not found' });
  return res.json({ ticket });
});

// 스태프/관리자: 전체 조회
router.get('/', staffAuth, async (req, res) => {
  const tickets = await Ticket.find({}).sort({ createdAt: -1 }).lean();
  return res.json({ tickets, syncedAt: new Date().toISOString() });
});

// 스태프/관리자: 입금 상태 변경
router.patch('/:id/payment', staffAuth, async (req, res) => {
  const { id } = req.params;
  const { isPaid } = req.body || {};

  const nextPaid = Boolean(isPaid);
  const update = { isPaid: nextPaid, paidAt: nextPaid ? new Date() : null };

  const ticket = await Ticket.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!ticket) return res.status(404).json({ message: 'Not found' });
  return res.json({ ticket });
});

// 스태프/관리자: 입장 처리(멱등)
router.patch('/:id/checkin', staffAuth, async (req, res) => {
  const { id } = req.params;
  const { isCheckedIn } = req.body || {};

  const nextIn = Boolean(isCheckedIn);
  const update = { isCheckedIn: nextIn, checkedInAt: nextIn ? new Date() : null };

  const ticket = await Ticket.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!ticket) return res.status(404).json({ message: 'Not found' });
  return res.json({ ticket });
});

// 스태프/관리자: CSV 내보내기(비상용 종이 명단)
router.get('/export.csv', staffAuth, async (req, res) => {
  const tickets = await Ticket.find({}).sort({ createdAt: 1 }).lean();
  const header = [
    'bookingNo',
    'name',
    'phoneLast4',
    'headcount',
    'depositorName',
    'isPaid',
    'isCheckedIn',
    'createdAt'
  ];

  const lines = [header.join(',')];
  for (const t of tickets) {
    lines.push(
      [
        t.bookingNo,
        t.name,
        t.phoneLast4,
        t.headcount,
        t.depositorName,
        t.isPaid,
        t.isCheckedIn,
        t.createdAt ? new Date(t.createdAt).toISOString() : ''
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gamma-ticketing.csv"');
  return res.send(lines.join('\n'));
});

module.exports = router;

