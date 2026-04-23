'use strict';

/**
 * Migration: Add compound indexes to pendingverifications collection (#399)
 *
 * retryService.js queries PendingVerification on every retry interval with:
 *   { status: 'pending', nextRetryAt: { $lte: now } }
 *
 * Without indexes on nextRetryAt this is a full collection scan. During a
 * Stellar outage the queue can grow to thousands of documents, making the
 * retry worker progressively slower.
 *
 * Mongoose only creates schema-declared indexes on new collections. This
 * migration ensures the indexes exist on collections created before the
 * model was updated.
 *
 * Indexes added:
 *   { nextRetryAt: 1, attempts: 1 }          — retry worker with attempts filter
 *   { schoolId: 1, nextRetryAt: 1 }          — school-scoped nextRetryAt queries
 *
 * The indexes { status: 1, nextRetryAt: 1 } and
 * { schoolId: 1, status: 1, nextRetryAt: 1 } were added in a prior commit
 * but also lack a migration; this script creates all four idempotently.
 */

const mongoose = require('mongoose');

const VERSION = '005_add_pending_verification_retry_indexes';

const INDEXES = [
  { key: { status: 1, nextRetryAt: 1 },           name: 'status_1_nextRetryAt_1' },
  { key: { schoolId: 1, status: 1, nextRetryAt: 1 }, name: 'schoolId_1_status_1_nextRetryAt_1' },
  { key: { nextRetryAt: 1, attempts: 1 },          name: 'nextRetryAt_1_attempts_1' },
  { key: { schoolId: 1, nextRetryAt: 1 },          name: 'schoolId_1_nextRetryAt_1' },
];

async function up() {
  const collection = mongoose.connection.collection('pendingverifications');
  for (const { key, name } of INDEXES) {
    await collection.createIndex(key, { name, background: true });
    console.log(`[005] Ensured index: ${name}`);
  }
}

async function down() {
  const collection = mongoose.connection.collection('pendingverifications');
  for (const { name } of INDEXES) {
    try {
      await collection.dropIndex(name);
      console.log(`[005] Dropped index: ${name}`);
    } catch (err) {
      if (err.codeName !== 'IndexNotFound') throw err;
    }
  }
}

module.exports = { version: VERSION, up, down };
