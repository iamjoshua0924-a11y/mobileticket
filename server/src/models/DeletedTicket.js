const mongoose = require('mongoose');

const DeletedTicketSchema = new mongoose.Schema(
  {
    originalId: { type: String, required: true, index: true },
    deletedAt: { type: Date, default: Date.now, index: true },
    deletedBy: { type: String, default: 'staff' },
    ticket: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeletedTicket', DeletedTicketSchema);

