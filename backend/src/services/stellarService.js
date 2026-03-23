const { server, SCHOOL_WALLET, isAcceptedAsset } = require('../config/stellarConfig');
const Payment = require('../models/paymentModel');
const Student = require('../models/studentModel');

/**
 * Detect asset information from a Stellar payment operation.
 * Returns { assetCode, assetType, assetIssuer } or null if unsupported.
 */
function detectAsset(payOp) {
  const assetType = payOp.asset_type;
  const assetCode = assetType === 'native' ? 'XLM' : payOp.asset_code;
  const assetIssuer = assetType === 'native' ? null : payOp.asset_issuer;

  const { accepted } = isAcceptedAsset(assetCode, assetType);
  if (!accepted) return null;

  return { assetCode, assetType, assetIssuer };
}

/**
 * Normalize a raw amount string to a number with consistent precision.
 */
function normalizeAmount(rawAmount) {
  return parseFloat(parseFloat(rawAmount).toFixed(7));
}

// Fetch recent transactions to the school wallet and record new payments
async function syncPayments() {
  const transactions = await server
    .transactions()
    .forAccount(SCHOOL_WALLET)
    .order('desc')
    .limit(20)
    .call();

  for (const tx of transactions.records) {
    const memo = tx.memo;
    if (!memo) continue;

    const exists = await Payment.findOne({ txHash: tx.hash });
    if (exists) continue;

    const ops = await tx.operations();
    const payOp = ops.records.find(op => op.type === 'payment' && op.to === SCHOOL_WALLET);
    if (!payOp) continue;

    // Detect asset type and reject unsupported assets
    const asset = detectAsset(payOp);
    if (!asset) continue; // skip unsupported assets

    const student = await Student.findOne({ studentId: memo });
    if (!student) continue;

    await Payment.create({
      studentId: memo,
      txHash: tx.hash,
      amount: normalizeAmount(payOp.amount),
      assetCode: asset.assetCode,
      assetType: asset.assetType,
      assetIssuer: asset.assetIssuer,
      memo,
      confirmedAt: new Date(tx.created_at),
    });

    await Student.findOneAndUpdate({ studentId: memo }, { feePaid: true });
  }
}

// Verify a single transaction hash against the school wallet
async function verifyTransaction(txHash) {
  const tx = await server.transactions().transaction(txHash).call();
  const ops = await tx.operations();
  const payOp = ops.records.find(op => op.type === 'payment' && op.to === SCHOOL_WALLET);
  if (!payOp) return null;

  // Detect asset and reject unsupported
  const asset = detectAsset(payOp);
  if (!asset) return { error: 'unsupported_asset', assetCode: payOp.asset_code || payOp.asset_type };

  return {
    hash: tx.hash,
    memo: tx.memo,
    amount: normalizeAmount(payOp.amount),
    assetCode: asset.assetCode,
    assetType: asset.assetType,
    assetIssuer: asset.assetIssuer,
    date: tx.created_at,
  };
}

module.exports = { syncPayments, verifyTransaction, detectAsset, normalizeAmount };
