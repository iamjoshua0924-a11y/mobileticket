const mongoose = require('mongoose');

const TicketHistorySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['created', 'updated', 'deleted', 'refund_requested', 'restored'], required: true },
    reason: { type: String, trim: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const RefundRequestSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['requested', 'processing', 'completed', 'rejected'], default: 'requested' },
    accountHolder: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    requestedAt: { type: Date },
    processedAt: { type: Date },
    note: { type: String, trim: true }
  },
  { _id: false }
);

const TicketSchema = new mongoose.Schema(
  {
    bookingNo: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    phoneLast4: { type: String, index: true, default: '' },
    headcount: { type: Number, required: true, min: 1 },
    depositorName: { type: String, trim: true, default: '' },

    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },

    isCheckedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },

    memo: { type: String, trim: true },
    source: { type: String, enum: ['online', 'onsite'], default: 'online' },
    // 레퍼럴 코드: k(키라키라윤) / b(비상대책회의) / 3(3061) / n(나나시)
    refCode: { type: String, enum: ['k', 'b', '3', 'n', null], default: null, index: true },
    refundRequest: { type: RefundRequestSchema },
    history: { type: [TicketHistorySchema], default: [] }
  },
  { timestamps: true }
);

TicketSchema.index({ name: 1 });
TicketSchema.index({ name: 1, phone: 1 });
TicketSchema.index({ createdAt: -1 });

TicketSchema.pre('validate', function setPhoneLast4(next) {
  if (this.phone && (!this.phoneLast4 || this.phoneLast4.length !== 4)) {
    const digits = String(this.phone).replace(/\D/g, '');
    this.phoneLast4 = digits.slice(-4) || '0000';
  }

  if (this.source === 'onsite') {
    this.phone = this.phone || '';
    this.depositorName = this.depositorName || '현장예매';
    this.phoneLast4 = this.phoneLast4 || '';
  }

  next();
});

module.exports = mongoose.model('Ticket', TicketSchema);
