# DukaanX Backend

REST API for DukaanX, a store, inventory, sales, and ledger management system.

## Requirements

- Node.js 20+
- MySQL 8+
- SMTP credentials for password recovery
- Cloudinary credentials to upload store/product images

## Setup

1. Run `npm install`.
2. Create a MySQL database.
3. Copy `.env.example` to `.env` and set database and JWT values. Use a random
   JWT secret with at least 32 characters.
4. Configure SMTP for password recovery. Configure Cloudinary to accept
   multipart image uploads; alternatively, send an existing image URL.
5. Run `npm run migrate`.
6. Start with `npm start` (or `npm run dev` for Node's watch mode).

The API listens on port 5000 by default. `GET /health` checks the HTTP process;
server startup also checks the MySQL connection.

## Render production configuration

Render must connect to a reachable hosted MySQL database. Add these environment
variables to the Render web service, replacing placeholders with values supplied
by your database provider:

```text
NODE_ENV=production
DB_HOST=<HOSTED_MYSQL_HOST>
DB_PORT=3306
DB_USER=<HOSTED_MYSQL_USER>
DB_PASSWORD=<HOSTED_MYSQL_PASSWORD>
DB_NAME=<HOSTED_MYSQL_DATABASE>
JWT_SECRET=<LONG_RANDOM_PRODUCTION_SECRET>
JWT_EXPIRES_IN=7d
```

Do not set `DB_HOST=localhost` on Render; that refers to the Render instance,
not a local computer or hosted database. Do not put database credentials in
source code or commit `.env`. Render provides the `PORT` value at runtime, and
the service must use `npm start`. After configuring the database variables, run
`npm run migrate` from the Render Shell to create/update the schema.

## Store authorization

Register or log in to receive a JWT. Store management endpoints need
`Authorization: Bearer <token>`. Other store-scoped endpoints additionally
require `X-Store-Id: <store-id>`. The API verifies that the authenticated user
belongs to that active store before running the operation.

## Database and stock

Migrations are applied in sorted filename order and tracked in
`schema_migrations`. Purchases create batches and stock transactions. Sales allocate from unexpired
batches using FEFO and lock batch rows while changing stock. Expired batch stock
is removed with a transaction at startup and once per day. Khata balances are
derived from opening balance plus ledger entries.

## Commands

- `npm start` — start the API
- `npm run dev` — restart on source changes
- `npm run migrate` — apply unapplied SQL migrations
- `npm test` — run dependency-free unit and route-surface tests

The tests do not require MySQL. Database-backed workflows should also be
exercised against a configured MySQL instance before deployment. Review
[API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for request formats and current
behavior and limitations.
