# SIMBA Ledger API (STAR + Black Dollar + PAGT Voting)

## Local Run
1) Install deps
npm install

2) Create Postgres and run schema
psql $DATABASE_URL -f sql/schema.sql

3) Start server
npm run dev

## Jobs
- Award stars from shares (3 shares = 1 STAR)
npm run job:shares

- Monthly free votes (1 free vote per member per month)
npm run job:monthlyVotes

- Recalculate ranks
npm run job:ranks
