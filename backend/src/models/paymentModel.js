const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  txHash: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  assetCode: { type: String, required: true, default: 'XLM' },
  assetType: { type: String, required: true, default: 'native' },
  assetIssuer: { type: String, default: null },
  memo: { type: String },
  confirmedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
