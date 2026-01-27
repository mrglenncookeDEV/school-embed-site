# D1 setup

## Apply migrations locally
npx wrangler d1 migrations apply <DATABASE_NAME> --local

## Apply migrations to production
npx wrangler d1 migrations apply <DATABASE_NAME>

## Inspect tables
npx wrangler d1 execute <DATABASE_NAME> --local --command "SELECT name FROM sqlite_master WHERE type='table';"
