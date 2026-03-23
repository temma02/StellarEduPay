const request = require('supertest');
const app = require('../backend/src/app');

jest.mock('../backend/src/models/studentModel', () => ({
  create: jest.fn().mockResolvedValue({ studentId: 'STU001', name: 'Alice', class: '5A', feeAmount: 200, feePaid: false }),
  find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
  findOne: jest.fn().mockResolvedValue({ studentId: 'STU001', name: 'Alice', class: '5A', feeAmount: 200, feePaid: false }),
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
}));

jest.mock('../backend/src/models/paymentModel', () => ({
  find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(true),
  Schema: class {
    constructor() { this.index = jest.fn(); }
  },
  model: jest.fn().mockReturnValue({}),
}));

jest.mock('../backend/src/services/stellarService', () => ({
  syncPayments: jest.fn().mockResolvedValue(),
  verifyTransaction: jest.fn().mockImplementation((txHash) => {
    if (txHash === 'unsupported_tx') {
      return Promise.resolve({ error: 'unsupported_asset', assetCode: 'SHIB' });
    }
    return Promise.resolve({
      hash: txHash,
      memo: 'STU001',
      amount: 200,
      assetCode: 'XLM',
      assetType: 'native',
      assetIssuer: null,
      date: new Date().toISOString(),
    });
  }),
}));

describe('Payment API', () => {
  test('GET /api/payments/instructions/:studentId returns wallet info with accepted assets', async () => {
    const res = await request(app).get('/api/payments/instructions/STU001');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('memo', 'STU001');
    expect(res.body).toHaveProperty('acceptedAssets');
    expect(Array.isArray(res.body.acceptedAssets)).toBe(true);
    expect(res.body.acceptedAssets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.acceptedAssets.some(a => a.code === 'XLM')).toBe(true);
  });

  test('POST /api/payments/verify returns transaction details with asset info', async () => {
    const res = await request(app).post('/api/payments/verify').send({ txHash: 'abc123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hash', 'abc123');
    expect(res.body).toHaveProperty('assetCode', 'XLM');
    expect(res.body).toHaveProperty('assetType', 'native');
  });

  test('POST /api/payments/verify rejects unsupported asset', async () => {
    const res = await request(app).post('/api/payments/verify').send({ txHash: 'unsupported_tx' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported asset/i);
  });

  test('POST /api/payments/sync returns success message', async () => {
    const res = await request(app).post('/api/payments/sync');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Sync complete');
  });

  test('GET /api/students/:studentId returns student', async () => {
    const res = await request(app).get('/api/students/STU001');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('studentId', 'STU001');
  });

  test('GET /api/payments/accepted-assets returns list of accepted assets', async () => {
    const res = await request(app).get('/api/payments/accepted-assets');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('assets');
    expect(res.body.assets.some(a => a.code === 'XLM')).toBe(true);
    expect(res.body.assets.some(a => a.code === 'USDC')).toBe(true);
  });
});
