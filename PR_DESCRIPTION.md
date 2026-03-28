# Write Architecture Documentation

Closes #228

## Summary

`docs/architecture.md` had only a brief stub. This PR rewrites it as a complete reference for new contributors covering every major component and their interactions.

## Changes

### Modified Files

| File | Description |
| ---- | ----------- |
| [`docs/architecture.md`](docs/architecture.md) | Full rewrite — diagrams, data flow, service roles, schema relationships |

## What's Documented

- High-level ASCII component diagram (browser → frontend → backend → MongoDB + Stellar)
- File-level component map for both frontend and backend
- Step-by-step data flow from fee setup through payment confirmation (5 steps with code paths)
- Role of every backend service: `stellarService`, `transactionService`, `retryService`, `consistencyService`, `reminderService`
- All controllers and their route ownership
- All middleware and their purpose
- MongoDB schema relationships with an ERD-style ASCII diagram and key constraints
- Background worker table (interval, purpose, start function)
- Multi-school tenancy model
- Error handling and resilience patterns (retry, circuit breaker, idempotency, graceful shutdown)

## Acceptance Criteria

- [x] A new developer can understand the full system architecture from this document
- [x] Data flow from payment initiation to confirmation is clearly described
- [x] All major components and their interactions are covered
