"use strict";

const mongoose = require("mongoose");

/**
 * Stores transactions that could not be verified due to a Stellar network outage.
 * schoolId is stored so the retry worker can use the correct school's Stellar
 * wallet address when re-attempting verification.
 */
const pendingVerificationSchema = new mongoose.Schema(
  {
    schoolId: { type: String, required: true, index: true },
    txHash: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    nextRetryAt: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ["pending", "processing", "resolved", "dead_letter"],
      default: "pending",
      index: true,
    },
    lastError: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Multi-school retry worker: filter by school, then find due items
pendingVerificationSchema.index({ schoolId: 1, status: 1, nextRetryAt: 1 });
// Retry worker: find pending items ready for retry (primary query path)
pendingVerificationSchema.index({ status: 1, nextRetryAt: 1 });
// Covers queries that filter on nextRetryAt + attempts (e.g. attempts < MAX)
pendingVerificationSchema.index({ nextRetryAt: 1, attempts: 1 });
// Covers schoolId-scoped queries on nextRetryAt without status filter
pendingVerificationSchema.index({ schoolId: 1, nextRetryAt: 1 });

module.exports = mongoose.model(
  "PendingVerification",
  pendingVerificationSchema,
);
