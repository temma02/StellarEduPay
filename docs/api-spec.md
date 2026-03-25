# API Reference

Base URL: `http://localhost:5000/api`

---

## Idempotency

`POST /api/payments/intent` and `POST /api/payments/verify` require an `Idempotency-Key` header. Use any unique string (e.g. a UUID). The server caches the response for 24 hours — sending the same key again returns the cached result without re-processing.

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

Missing the header returns:

```json
HTTP 400
{ "error": "Idempotency-Key header is required for this request", "code": "MISSING_IDEMPOTENCY_KEY" }
```

---

## Health

### Health check
```
GET /health
```
Response `200`:
```json
{ "status": "ok" }
```

---

## Students

### Register a student
```
POST /api/students
```
Body:
```json
{ "studentId": "STU001", "name": "Alice Johnson", "class": "5A", "feeAmount": 250 }
```
`feeAmount` is optional if a fee structure exists for the class — it will be auto-assigned.

Response `201`:
```json
{
  "studentId": "STU001",
  "name": "Alice Johnson",
  "class": "5A",
  "feeAmount": 250,
  "feePaid": false,
  "totalPaid": 0,
  "remainingBalance": null
}
```

Errors:
- `400` — missing/invalid fields
- `400` — no `feeAmount` provided and no fee structure found for the class

### List all students
```
GET /api/students
```
Response `200`: array of student objects, sorted by `createdAt` descending.

### Get a student
```
GET /api/students/:studentId
```
Response `200`: student object.

Errors:
- `400` — invalid `studentId` format (must be 3–20 alphanumeric characters)
- `404` — student not found

---

## Fee Structures

### Create / update a fee structure
```
POST /api/fees
```
Body:
```json
{ "className": "5A", "feeAmount": 250, "description": "Grade 5A annual fees", "academicYear": "2026" }
```
`description` and `academicYear` are optional. If a fee structure for the class already exists it is updated (upsert).

Response `201`:
```json
{ "className": "5A", "feeAmount": 250, "description": "Grade 5A annual fees", "academicYear": "2026", "isActive": true }
```

Errors:
- `400` — `className` or `feeAmount` missing/invalid

### List all fee structures
```
GET /api/fees
```
Response `200`: array of active fee structures, sorted by `className`.

### Get fee for a class
```
GET /api/fees/:className
```
Response `200`: fee structure object.

Errors:
- `404` — no active fee structure found for the class

### Deactivate a fee structure
```
DELETE /api/fees/:className
```
Response `200`:
```json
{ "message": "Fee structure for class 5A deactivated" }
```

Errors:
- `404` — fee structure not found

---

## Payments

### Get payment instructions
```
GET /api/payments/instructions/:studentId
```
Response `200`:
```json
{
  "walletAddress": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "memo": "STU001",
  "acceptedAssets": [
    { "code": "XLM",  "type": "native",          "displayName": "Stellar Lumens" },
    { "code": "USDC", "type": "credit_alphanum4", "displayName": "USD Coin" }
  ],
  "note": "Include the payment intent memo exactly when sending payment to ensure your fees are credited."
}
```

### List accepted assets
```
GET /api/payments/accepted-assets
```
Response `200`:
```json
{
  "assets": [
    { "code": "XLM",  "type": "native",          "displayName": "Stellar Lumens" },
    { "code": "USDC", "type": "credit_alphanum4", "displayName": "USD Coin" }
  ]
}
```

### Create a payment intent
```
POST /api/payments/intent
Idempotency-Key: <unique-key>
```
Body:
```json
{ "studentId": "STU001" }
```
Creates a payment intent with a unique memo and a 2-hour expiry. The parent must include this memo when sending the Stellar transaction.

Response `201`:
```json
{
  "studentId": "STU001",
  "amount": 250,
  "memo": "A3F1C2B4",
  "status": "pending",
  "expiresAt": "2026-03-24T12:00:00.000Z"
}
```

Errors:
- `400` — missing `Idempotency-Key` header
- `404` — student not found

### Verify a transaction
```
POST /api/payments/verify
Idempotency-Key: <unique-key>
```
Body:
```json
{ "txHash": "a1b2c3d4...64hexchars" }
```
Looks up the transaction on the Stellar ledger, validates the destination wallet, memo, and asset, then compares the amount against the student's fee.

Response `200`:
```json
{
  "hash": "a1b2c3d4...",
  "memo": "STU001",
  "amount": 250.0000000,
  "assetCode": "XLM",
  "assetType": "native",
  "feeAmount": 250,
  "feeValidation": {
    "status": "valid",
    "message": "Payment matches the required fee"
  },
  "date": "2026-03-23T10:00:00Z"
}
```

`feeValidation.status` is one of:

| Value | Meaning |
|---|---|
| `valid` | Amount matches the required fee exactly |
| `underpaid` | Amount is less than the required fee |
| `overpaid` | Amount exceeds the required fee |
| `unknown` | Student not found; cannot validate |

Errors:
- `400` — missing `Idempotency-Key` header
- `400` — `txHash` is not a 64-character hex string
- `400` — transaction failed on-chain (`TX_FAILED`)
- `400` — transaction has no memo (`MISSING_MEMO`)
- `400` — payment destination is not the school wallet (`INVALID_DESTINATION`)
- `400` — asset is not accepted (`UNSUPPORTED_ASSET`)
- `404` — transaction not found
- `409` — transaction already processed (`DUPLICATE_TX`)
- `502` — Stellar network unreachable (`STELLAR_NETWORK_ERROR`)

### Sync payments from ledger
```
POST /api/payments/sync
```
Fetches the 20 most recent transactions to the school wallet, matches memos to pending payment intents, validates amounts, and records new payments. Safe to call repeatedly — already-processed transactions are skipped.

Response `200`:
```json
{ "message": "Sync complete" }
```

### Finalize pending payments
```
POST /api/payments/finalize
```
Re-checks all `pending_confirmation` payments against the current ledger. Payments that have met the confirmation threshold (`CONFIRMATION_THRESHOLD`, default: 2) are promoted to `confirmed` and the student's balance is updated.

Response `200`:
```json
{ "message": "Finalization complete" }
```

### Get payment history for a student
```
GET /api/payments/:studentId
```
Response `200`: array of payment objects, sorted by `confirmedAt` descending.

```json
[
  {
    "studentId": "STU001",
    "txHash": "a1b2c3d4...",
    "amount": 250.0000000,
    "feeAmount": 250,
    "feeValidationStatus": "valid",
    "excessAmount": 0,
    "status": "confirmed",
    "memo": "A3F1C2B4",
    "senderAddress": "GSENDER...",
    "isSuspicious": false,
    "confirmationStatus": "confirmed",
    "confirmedAt": "2026-03-23T10:00:00.000Z"
  }
]
```

### Get student balance
```
GET /api/payments/balance/:studentId
```
Returns the cumulative payment summary for a student, aggregated across all confirmed payments.

Response `200`:
```json
{
  "studentId": "STU001",
  "feeAmount": 250,
  "totalPaid": 250.0000000,
  "remainingBalance": 0,
  "excessAmount": 0,
  "feePaid": true,
  "installmentCount": 1
}
```

Errors:
- `404` — student not found

### List overpayments
```
GET /api/payments/overpayments
```
Returns all payments where `feeValidationStatus` is `overpaid`.

Response `200`:
```json
{
  "count": 1,
  "totalExcess": 10.0000000,
  "overpayments": [ /* payment objects */ ]
}
```

### List suspicious payments
```
GET /api/payments/suspicious
```
Returns payments flagged as suspicious (memo collision or unusual amount).

Response `200`:
```json
{
  "count": 1,
  "suspicious": [ /* payment objects with suspicionReason */ ]
}
```

### List pending confirmations
```
GET /api/payments/pending
```
Returns payments with `confirmationStatus: "pending_confirmation"`.

Response `200`:
```json
{
  "count": 2,
  "pending": [ /* payment objects */ ]
}
```

---

## Error Response Format

All errors follow this shape:

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body or params |
| `MISSING_IDEMPOTENCY_KEY` | 400 | `Idempotency-Key` header missing |
| `TX_FAILED` | 400 | Stellar transaction failed on-chain |
| `MISSING_MEMO` | 400 | Transaction has no memo |
| `INVALID_DESTINATION` | 400 | Payment not sent to school wallet |
| `UNSUPPORTED_ASSET` | 400 | Asset not in accepted list |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_TX` | 409 | Transaction already processed |
| `STELLAR_NETWORK_ERROR` | 502 | Horizon API unreachable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
