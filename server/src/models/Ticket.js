const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema(
  {
    bookingNo: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    phoneLast4: { type: String, required: true, index: true },
    headcount: { type: Number, required: true, min: 1 },
    depositorName: { type: String, required: true, trim: true },

    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },

    isCheckedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },

    memo: { type: String, trim: true }
  },
  { timestamps: true }
);

TicketSchema.index({ name: 1 });
TicketSchema.index({ createdAt: -1 });

TicketSchema.pre('validate', function setPhoneLast4(next) {
  if (this.phone && (!this.phoneLast4 || this.phoneLast4.length !== 4)) {
    const digits = String(this.phone).replace(/\D/g, '');
    this.phoneLast4 = digits.slice(-4) || '0000';
  }
  next();
});

module.exports = mongoose.model('Ticket', TicketSchema);

