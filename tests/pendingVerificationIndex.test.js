'use strict';

/**
 * Tests for issue #399 — compound indexes on pendingverifications.
 *
 * Verifies:
 *  1. The Mongoose schema declares the required compound indexes.
 *  2. The migration script creates all four indexes idempotently and
 *     drops them on rollback.
 */

// ── Model index tests ─────────────────────────────────────────────────────────

describe('pendingVerificationModel — index declarations', () => {
  // Mongoose stores schema indexes in schema.indexes() as [fields, options] pairs.
  let indexes;

  beforeAll(() => {
    // Mock mongoose so the model can be required without a real connection
    jest.mock('mongoose', () => {
      const schema = {
        _indexes: [],
        index(fields) { this._indexes.push(fields); return this; },
        indexes() { return this._indexes; },
        add: jest.fn(),
        path: jest.fn().mockReturnValue({ index: jest.fn() }),
      };
      return {
        Schema: jest.fn(() => schema),
        model: jest.fn(() => ({})),
      };
    });

    const mongoose = require('mongoose');
    // Capture the schema instance created by the model file
    require('../backend/src/models/pendingVerificationModel');
    const schemaInstance = mongoose.Schema.mock.results[0].value;
    indexes = schemaInstance.indexes();
  });

  afterAll(() => jest.resetModules());

  function hasIndex(fields) {
    return indexes.some(idx => {
      const keys = Object.keys(fields);
      return keys.every(k => idx[k] === fields[k]) && Object.keys(idx).length === keys.length;
    });
  }

  test('declares { status: 1, nextRetryAt: 1 }', () => {
    expect(hasIndex({ status: 1, nextRetryAt: 1 })).toBe(true);
  });

  test('declares { schoolId: 1, status: 1, nextRetryAt: 1 }', () => {
    expect(hasIndex({ schoolId: 1, status: 1, nextRetryAt: 1 })).toBe(true);
  });

  test('declares { nextRetryAt: 1, attempts: 1 }', () => {
    expect(hasIndex({ nextRetryAt: 1, attempts: 1 })).toBe(true);
  });

  test('declares { schoolId: 1, nextRetryAt: 1 }', () => {
    expect(hasIndex({ schoolId: 1, nextRetryAt: 1 })).toBe(true);
  });
});

// ── Migration script tests ────────────────────────────────────────────────────

describe('migration 005 — add_pending_verification_retry_indexes', () => {
  let migration;
  let mockCollection;

  beforeEach(() => {
    jest.resetModules();

    mockCollection = {
      createIndex: jest.fn().mockResolvedValue('index_name'),
      dropIndex: jest.fn().mockResolvedValue(undefined),
    };

    jest.mock('mongoose', () => ({
      connection: {
        collection: jest.fn(() => mockCollection),
      },
    }));

    migration = require('../backend/migrations/005_add_pending_verification_retry_indexes');
  });

  test('exports correct version string', () => {
    expect(migration.version).toBe('005_add_pending_verification_retry_indexes');
  });

  test('up() creates all four indexes', async () => {
    await migration.up();
    expect(mockCollection.createIndex).toHaveBeenCalledTimes(4);
  });

  test('up() creates { status: 1, nextRetryAt: 1 }', async () => {
    await migration.up();
    expect(mockCollection.createIndex).toHaveBeenCalledWith(
      { status: 1, nextRetryAt: 1 },
      expect.objectContaining({ name: 'status_1_nextRetryAt_1' })
    );
  });

  test('up() creates { schoolId: 1, status: 1, nextRetryAt: 1 }', async () => {
    await migration.up();
    expect(mockCollection.createIndex).toHaveBeenCalledWith(
      { schoolId: 1, status: 1, nextRetryAt: 1 },
      expect.objectContaining({ name: 'schoolId_1_status_1_nextRetryAt_1' })
    );
  });

  test('up() creates { nextRetryAt: 1, attempts: 1 }', async () => {
    await migration.up();
    expect(mockCollection.createIndex).toHaveBeenCalledWith(
      { nextRetryAt: 1, attempts: 1 },
      expect.objectContaining({ name: 'nextRetryAt_1_attempts_1' })
    );
  });

  test('up() creates { schoolId: 1, nextRetryAt: 1 }', async () => {
    await migration.up();
    expect(mockCollection.createIndex).toHaveBeenCalledWith(
      { schoolId: 1, nextRetryAt: 1 },
      expect.objectContaining({ name: 'schoolId_1_nextRetryAt_1' })
    );
  });

  test('down() drops all four indexes', async () => {
    await migration.down();
    expect(mockCollection.dropIndex).toHaveBeenCalledTimes(4);
  });

  test('down() is idempotent — ignores IndexNotFound errors', async () => {
    mockCollection.dropIndex.mockRejectedValue({ codeName: 'IndexNotFound' });
    await expect(migration.down()).resolves.not.toThrow();
  });

  test('down() re-throws non-IndexNotFound errors', async () => {
    mockCollection.dropIndex.mockRejectedValue(new Error('unexpected'));
    await expect(migration.down()).rejects.toThrow('unexpected');
  });
});
