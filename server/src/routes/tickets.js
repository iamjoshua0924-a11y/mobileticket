const express = require('express');
const Ticket = require('../models/Ticket');
const DeletedTicket = require('../models/DeletedTicket');
const { staffAuth, requireStaffPermission } = require('../middleware/staffAuth');
const { makeBookingNo } = require('../utils/bookingNo');

const router = express.Router();

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function makeLoosePhoneRegex(phoneDigits) {
  const digits = normalizePhone(phoneDigits);
  if (!digits) return null;
  // 각 숫자 사이에 하이픈/공백 등 비숫자 문자가 섞여 있어도 매칭되도록 처리
  // 예: 01012345678 -> ^\D*0\D*1\D*0\D*1...8\D*$
  return new RegExp(`^\\D*${digits.split('').join('\\D*')}\\D*$`);
}

function cleanSnapshot(ticket) {
  if (!ticket) return null;
  const obj = typeof ticket.toObject === 'function' ? ticket.toObject() : { ...ticket };
  delete obj.__v;
  delete obj.history;
  // 레퍼럴은 스태프 일반 화면에서 노출하지 않음(정산에서만 집계)
  delete obj.refCode;
  return obj;
}

function buildTicketPayload(body, fallback = {}) {
  const name = String(body?.name ?? fallback.name ?? '').trim();
  const phone = String(body?.phone ?? fallback.phone ?? '').trim();
  const headcount = Number(body?.headcount ?? fallback.headcount ?? 1);
  const depositorName = String(body?.depositorName ?? fallback.depositorName ?? '').trim();
  const refCodeRaw = body?.refCode ?? fallback.refCode ?? null;
  const refCode = ['k', 'b', '3', 'n'].includes(String(refCodeRaw)) ? String(refCodeRaw) : null;
  return { name, phone, headcount, depositorName, refCode };
}

function isValidReservation(payload) {
  const phoneDigits = normalizePhone(payload.phone);
  return Boolean(payload.name && phoneDigits && payload.depositorName && Number.isFinite(payload.headcount) && payload.headcount >= 1);
}

async function generateUniqueBookingNo() {
  for (let i = 0; i < 5; i += 1) {
    const bookingNo = makeBookingNo();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Ticket.exists({ bookingNo });
    if (!exists) return bookingNo;
  }
  return null;
}

function pushHistory(ticket, action, reason) {
  ticket.history = ticket.history || [];
  ticket.history.push({
    action,
    reason: reason || '',
    snapshot: cleanSnapshot(ticket),
    changedAt: new Date()
  });
}

// 관객: 이름+전화번호 중복 여부 사전 확인
router.post('/duplicate-check', async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) return res.status(400).json({ message: 'Invalid payload' });

  const nameTrim = String(name).trim();
  const phoneTrim = String(phone).trim();
  const phoneRe = makeLoosePhoneRegex(phoneTrim);
  if (!phoneRe) return res.status(400).json({ message: 'Invalid payload' });

  const existingTicket = await Ticket.findOne({
    name: nameTrim,
    phone: { $regex: phoneRe }
  })
    .sort({ updatedAt: -1 })
    .lean();

  return res.json({ exists: Boolean(existingTicket), ticket: existingTicket || null });
});

// 관객: 예매 생성 / 기존 예약 갱신
router.post('/', async (req, res) => {
  try {
    const mode = req.body?.mode || 'create';
    const reason = String(req.body?.reason || '').trim();
    const payload = buildTicketPayload(req.body);

    if (!isValidReservation(payload)) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const phoneRe = makeLoosePhoneRegex(payload.phone);
    if (!phoneRe) return res.status(400).json({ message: 'Invalid payload' });

    const existingTicket = await Ticket.findOne({
      name: payload.name,
      phone: { $regex: phoneRe }
    }).sort({ updatedAt: -1 });

    if (existingTicket && mode === 'create') {
      return res.status(409).json({
        code: 'DUPLICATE_EXISTS',
        message: '기존 예약내역이 있습니다.',
        existingTicket: cleanSnapshot(existingTicket)
      });
    }

    if (existingTicket && (mode === 'replace' || mode === 'edit')) {
      if (existingTicket.isPaid && !reason) {
        return res.status(409).json({
          code: 'REASON_REQUIRED',
          message: '입금정보가 확정된 티켓 수정에는 사유가 필요합니다.',
          existingTicket: cleanSnapshot(existingTicket)
        });
      }

      pushHistory(existingTicket, 'updated', reason || (mode === 'replace' ? '새 정보로 갱신' : '예약 내용 수정'));
      existingTicket.name = payload.name;
      existingTicket.phone = payload.phone;
      existingTicket.headcount = payload.headcount;
      existingTicket.depositorName = payload.depositorName;
      // 레퍼럴은 최초 유입을 보존: 기존에 없을 때만 채움
      if (!existingTicket.refCode && payload.refCode) existingTicket.refCode = payload.refCode;
      await existingTicket.save();
      return res.status(200).json({ ticket: cleanSnapshot(existingTicket), action: 'updated' });
    }

    const bookingNo = await generateUniqueBookingNo();
    if (!bookingNo) return res.status(500).json({ message: 'Failed to generate booking number' });

    const ticket = await Ticket.create({
      bookingNo,
      ...payload,
      source: 'online',
      refCode: payload.refCode || null
    });

    pushHistory(ticket, 'created', '최초 생성');
    await ticket.save();

    return res.status(201).json({ ticket: cleanSnapshot(ticket), action: 'created' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// 관객: 현장예매 입력(스태프)
router.post('/onsite', staffAuth, requireStaffPermission('createOnsite'), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const headcount = Number(req.body?.headcount || 1);
  const refCodeRaw = req.body?.refCode ?? null;
  const refCode = ['k', 'b', '3', 'n'].includes(String(refCodeRaw)) ? String(refCodeRaw) : null;
  if (!name || !Number.isFinite(headcount) || headcount < 1) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const bookingNo = await generateUniqueBookingNo();
  if (!bookingNo) return res.status(500).json({ message: 'Failed to generate booking number' });

  const ticket = await Ticket.create({
    bookingNo,
    name,
    headcount,
    phone: '',
    phoneLast4: '',
    depositorName: '현장예매',
    source: 'onsite',
    refCode,
    isPaid: true,
    paidAt: new Date()
    ,
    isCheckedIn: true,
    checkedInAt: new Date()
  });

  pushHistory(ticket, 'created', '현장예매 입력');
  await ticket.save();
  return res.status(201).json({ ticket: cleanSnapshot(ticket) });
});

// 관객: 예매번호로 조회
router.get('/by-booking/:bookingNo', async (req, res) => {
  const { bookingNo } = req.params;
  const ticket = await Ticket.findOne({ bookingNo }).lean();
  if (!ticket) return res.status(404).json({ message: 'Not found' });
  return res.json({ ticket });
});

// 관객: 옵션형 조회 (이름+전화 / 예매번호)
router.post('/lookup', async (req, res) => {
  const mode = req.body?.mode || 'booking';

  if (mode === 'booking') {
    const bookingNo = String(req.body?.bookingNo || '').trim();
    const ticket = await Ticket.findOne({ bookingNo }).lean();
    if (!ticket) return res.status(404).json({ message: 'Not found' });
    return res.json({ ticket });
  }

  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const phoneRe = makeLoosePhoneRegex(phone);
  if (!phoneRe) return res.status(400).json({ message: 'Invalid payload' });
  const ticket = await Ticket.findOne({ name, phone: { $regex: phoneRe } }).sort({ updatedAt: -1 }).lean();
  if (!ticket) return res.status(404).json({ message: 'Not found' });
  return res.json({ ticket });
});

// 관객: 환불 신청
router.post('/:id/refund-request', async (req, res) => {
  const { id } = req.params;
  const accountHolder = String(req.body?.accountHolder || '').trim();
  const bankName = String(req.body?.bankName || '').trim();
  const accountNumber = String(req.body?.accountNumber || '').trim();

  if (!accountHolder || !bankName || !accountNumber) {
    return res.status(400).json({ message: '환불계좌 정보가 필요합니다.' });
  }

  const ticket = await Ticket.findById(id);
  if (!ticket) return res.status(404).json({ message: 'Not found' });

  pushHistory(ticket, 'refund_requested', '예약취소/환불신청');
  ticket.refundRequest = {
    status: 'requested',
    accountHolder,
    bankName,
    accountNumber,
    requestedAt: new Date(),
    note: ''
  };
  await ticket.save();

  return res.json({
    message: '취소되었습니다. 시일 내에 액수 확인 후 환불계좌로 입금드리겠습니다.',
    ticket: cleanSnapshot(ticket)
  });
});

// 스태프/관리자: 전체 조회
router.get('/', staffAuth, async (req, res) => {
  const tickets = await Ticket.find({}).sort({ createdAt: -1 }).lean();
  const deletedLogs = req.staffAccess?.permissions?.viewDeleted
    ? await DeletedTicket.find({}).sort({ deletedAt: -1 }).lean()
    : [];
  return res.json({ tickets, deletedLogs, syncedAt: new Date().toISOString() });
});

router.get('/settlement', staffAuth, requireStaffPermission('settlement'), async (req, res) => {
  const tickets = await Ticket.find({}).lean();
  const totalHeadcount = tickets
    .filter((t) => t.isPaid || t.source === 'onsite')
    .reduce((sum, t) => sum + Number(t.headcount || 0), 0);

  const referralCounts = { k: 0, b: 0, '3': 0, n: 0 };
  for (const t of tickets) {
    if (!(t.isPaid || t.source === 'onsite')) continue;
    const rc = t.refCode;
    if (rc === 'k' || rc === 'b' || rc === '3' || rc === 'n') {
      referralCounts[rc] += Number(t.headcount || 0);
    }
  }

  return res.json({
    totalHeadcount,
    revenue: totalHeadcount * 5000,
    // (k/b/3/n) 순서로 표기하기 위함
    referralCounts,
    referralCountsOrder: [referralCounts.k, referralCounts.b, referralCounts['3'], referralCounts.n]
  });
});

// 스태프/관리자: 삭제로그 복구
router.post('/deleted/:id/restore', staffAuth, requireStaffPermission('restoreDeleted'), async (req, res) => {
  const deletedLog = await DeletedTicket.findById(req.params.id);
  if (!deletedLog) return res.status(404).json({ message: 'Not found' });

  const snapshot = { ...deletedLog.ticket };
  delete snapshot._id;
  delete snapshot.id;
  delete snapshot.createdAt;
  delete snapshot.updatedAt;

  const restored = await Ticket.create(snapshot);
  pushHistory(restored, 'restored', '삭제로그에서 복구');
  await restored.save();
  await deletedLog.deleteOne();

  return res.json({ ticket: cleanSnapshot(restored) });
});

router.patch('/:id/refund-status', staffAuth, requireStaffPermission('refund'), async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Not found' });
  if (!ticket.refundRequest) return res.status(400).json({ message: '환불신청 없음' });

  const nextStatus = String(req.body?.status || '').trim();
  if (!['requested', 'processing', 'completed', 'rejected'].includes(nextStatus)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  ticket.refundRequest.status = nextStatus;
  if (nextStatus === 'completed') ticket.refundRequest.processedAt = new Date();
  ticket.markModified('refundRequest');
  await ticket.save();
  return res.json({ ticket: cleanSnapshot(ticket) });
});

// 스태프/관리자: 입금 상태 변경
router.patch('/:id/payment', staffAuth, requireStaffPermission('payment'), async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Not found' });

  const nextPaid = Boolean(req.body?.isPaid);
  ticket.isPaid = nextPaid;
  ticket.paidAt = nextPaid ? new Date() : null;
  await ticket.save();
  return res.json({ ticket: cleanSnapshot(ticket) });
});

// 스태프/관리자: 입장 처리
router.patch('/:id/checkin', staffAuth, requireStaffPermission('checkin'), async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Not found' });

  const nextIn = Boolean(req.body?.isCheckedIn);
  ticket.isCheckedIn = nextIn;
  ticket.checkedInAt = nextIn ? new Date() : null;
  await ticket.save();
  return res.json({ ticket: cleanSnapshot(ticket) });
});

// 관리자: ref 없음 티켓에만 refCode 배정
router.patch('/:id/ref-code', staffAuth, requireStaffPermission('assignRef'), async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Not found' });

  if (ticket.refCode) {
    return res.status(409).json({ message: '이미 응원팀이 배정된 티켓입니다.' });
  }

  const refCodeRaw = String(req.body?.refCode || '').trim();
  if (!['k', 'b', '3', 'n'].includes(refCodeRaw)) {
    return res.status(400).json({ message: 'Invalid refCode' });
  }

  ticket.refCode = refCodeRaw;
  pushHistory(ticket, 'updated', `응원팀 배정: ${refCodeRaw}`);
  await ticket.save();
  return res.json({ ticket: cleanSnapshot(ticket) });
});

// 스태프/관리자: 예약 삭제 -> 삭제로그로 이동
router.delete('/:id', staffAuth, requireStaffPermission('deleteTicket'), async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Not found' });

  await DeletedTicket.create({
    originalId: String(ticket._id),
    deletedAt: new Date(),
    deletedBy: 'staff',
    ticket: cleanSnapshot(ticket)
  });

  await ticket.deleteOne();
  return res.json({ deletedId: req.params.id });
});

// 스태프/관리자: CSV 내보내기
router.get('/export.csv', staffAuth, requireStaffPermission('exportCsv'), async (req, res) => {
  const tickets = await Ticket.find({}).sort({ createdAt: 1 }).lean();
  const header = [
    'bookingNo',
    'name',
    'phoneLast4',
    'headcount',
    'depositorName',
    'source',
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
        t.source,
        t.isPaid,
        t.isCheckedIn,
        t.createdAt ? new Date(t.createdAt).toISOString() : ''
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="summer-splash.csv"');
  return res.send(lines.join('\n'));
});

module.exports = router;
