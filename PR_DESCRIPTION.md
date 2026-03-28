# PaymentForm: Show Payment History After Lookup

Closes #229

## Summary

After a parent looked up a student, they saw payment instructions but no history of past payments. `GET /api/payments/:studentId` existed but was never called from the frontend. This PR wires it up and renders results using the existing `TransactionCard` component.
# Add Dockerfile for Frontend Service

Closes #235

## Summary

`docker-compose.yml` references `build: ./frontend` but no `Dockerfile` existed, causing `docker compose up` to fail for the frontend service. This PR adds the missing file along with the required Next.js config for standalone output.

## Changes

### New Files

| File | Description |
| ---- | ----------- |
| [`frontend/src/components/PaymentForm.jsx`](frontend/src/components/PaymentForm.jsx) | Fetches payment history in `handleSubmit`, renders it below instructions |

## Implementation

`getStudentPayments` is added to the existing `Promise.all` in `handleSubmit` so all three requests fire in parallel — no extra loading time:

```js
const [stuRes, instrRes, paymentsRes] = await Promise.all([
  getStudent(studentId),
  getPaymentInstructions(studentId),
  getStudentPayments(studentId),
]);
```

Results are rendered with `<TransactionCard />`. An empty array shows "No payments recorded yet."

## Acceptance Criteria

- [x] Payment history is displayed after a successful student lookup
- [x] Each payment shows hash, amount, and date
- [x] Empty state is handled gracefully
| [`frontend/Dockerfile`](frontend/Dockerfile) | Multi-stage Docker build for the Next.js frontend |
| [`frontend/next.config.js`](frontend/next.config.js) | Enables `output: 'standalone'` required by the Docker runner stage |

### Modified Files

| File | Description |
| ---- | ----------- |
| [`docker-compose.yml`](docker-compose.yml) | Passes `NEXT_PUBLIC_API_URL` as a build arg so it is baked in at build time |

## Implementation Details

- Two-stage build: `builder` compiles the Next.js app, `runner` serves only the standalone output (smaller final image)
- `NEXT_PUBLIC_API_URL` is passed as a `ARG`/`ENV` during the build stage — Next.js inlines `NEXT_PUBLIC_*` vars at compile time, so a runtime `environment:` entry alone is not sufficient
- Runs as a non-root user (`appuser`) for security
- `output: 'standalone'` in `next.config.js` produces a self-contained `server.js` with minimal dependencies

## Acceptance Criteria

- [x] `docker compose up` builds and starts the frontend container successfully
- [x] Frontend is accessible at `http://localhost:3000`
- [x] `NEXT_PUBLIC_API_URL` is correctly injected at build time
