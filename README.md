# Backend Integration Test

A Node.js/PostgreSQL implementation of the Casino <-> Game Provider
integration described in the technical assessment.

It demonstrates:

- bidirectional HTTP communication
- HMAC-SHA256 authentication
- Casino-authoritative wallet management
- atomic and idempotent debit/credit processing
- rollback and tombstone handling
- Provider-side round/transaction tracking
- end-to-end game-round simulation

## Prerequisites

Install:

- Node.js 18+
- PostgreSQL
- npm

Verify:

```bash
node --version
npm --version
psql --version
```

## Installation
- Clone the repository and install dependencies
```bash
npm install
```
- Create a PostgreSQL user and database
```bash
CREATE ROLE jaqpot WITH LOGIN PASSWORD 'jaqpot';
CREATE DATABASE jaqpot_test OWNER jaqpot;
```
- Create a .env file. The secrets below are development values only. 
Production secrets should be stored using a secure secret-management mechanism
```bash
PORT=3000
DATABASE_URL=postgresql://jaqpot:jaqpot@localhost:5432/jaqpot_test

CASINO_SECRET=casino-development-secret
PROVIDER_SECRET=provider-development-secret

BASE_URL=http://localhost:3000
```
- DB setup : Run the initial schema migration
```bash
psql -h localhost -U jaqpot -d jaqpot_test \
  -f db/migrations/001_initial_schema.sql
```
- Load the demo data:
```bash
psql -h localhost -U jaqpot -d jaqpot_test \
  -f db/seeds/001_seed.sql
```
- Run the application: provided for mac
```bash
brew services start postgresql@16
```
- Start the dev server
```bash
npm run dev
```
- Health checks:
```bash
curl http://localhost:3000/casino/health
curl http://localhost:3000/provider/health
```
- Run full simulation
```bash
curl -X POST \
  http://localhost:3000/casino/simulateRound \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "gameId": 1,
    "currencyCode": "USD"
  }'
```
The simulation performs:
Launch
→ Balance Check
→ Bet
→ Rollback
→ Bet
→ Payout

## Design Notes
- Casino and Provider share one physical database for the assessment but remain logically separated through casino_* and provider_* tables.
- Casino is the source of truth for wallet balances.
- Money is stored in minor units using PostgreSQL BIGINT.
- Wallet mutations use transactions and SELECT ... FOR UPDATE.
- Duplicate transaction IDs return the original cached response without moving money again.
- Provider transaction IDs are deterministic within a simulation session, making simulation retries safe.
- Rollback after payout is rejected; rollback of a missing bet creates a tombstone without changing the balance.
- Note: for the demo flow, `playable_balance` is used for bets and payouts. The assessment does not define allocation rules between playable and redeemable balances.




