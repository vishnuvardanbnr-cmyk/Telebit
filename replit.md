# Telebit Exchange

A full-featured institutional-grade USDT (BEP-20) investment platform on BSC. Users can deposit USDT to an isolated wallet, withdraw to external addresses, send P2P transfers to other users, and view full history. Includes an admin panel for user management, withdrawal approvals, and platform settings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/crypto-exchange run dev` — run the frontend (port 21630, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — used for wallet key encryption (AES-256-CBC) AND JWT session tokens (HMAC-SHA256)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + custom cookie-based JWT auth (no Clerk)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Wouter + Tailwind v4
- Blockchain: ethers.js v6, BSC mainnet, USDT BEP-20

## Where things live

- `lib/db/src/schema/` — Drizzle DB schema (users, deposits, withdrawals, p2p_transfers, platform_settings)
- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/` — Orval-generated React Query hooks
- `artifacts/api-server/src/routes/` — Express route handlers (users, deposits, withdrawals, p2p, settings, admin)
- `artifacts/api-server/src/lib/` — auth middleware, wallet generation, crypto utils, settings
- `artifacts/crypto-exchange/src/pages/` — all frontend pages

## Architecture decisions

- **Isolated wallets**: Each user gets a unique BSC wallet for deposits; private keys are AES-256-CBC encrypted using `SESSION_SECRET` before DB storage.
- **Custom JWT auth**: Backend issues HMAC-SHA256 tokens signed with `SESSION_SECRET`, stored as HTTP-only `sid` cookies (30-day expiry). `requireAuth` middleware verifies the cookie and attaches `req.dbUser`. Frontend auth state comes from `useAuth()` which wraps `useGetMe()` — no Clerk SDK anywhere.
- **Contract-first API**: OpenAPI spec drives both server validation (Zod schemas) and client data fetching (React Query hooks via Orval codegen).
- **Admin via DB**: First admin must be set manually via `UPDATE users SET is_admin = true WHERE ...` — no self-promotion endpoint.
- **USDT contract**: `0x55d398326f99059fF775485246999027B3197955` on BSC mainnet (18 decimals).

## Product

- **Deposit**: Users get a unique BEP-20 wallet address with QR code; deposits are detected on-chain.
- **Withdraw**: Submit withdrawal request; admins approve and the API sweeps USDT to the target address.
- **P2P Transfer**: Instant internal USDT transfers between platform users by username/email.
- **History**: Full tabbed transaction history (deposits, withdrawals, P2P).
- **Admin Panel**: User management (block/unblock), withdrawal queue (approve/reject), platform settings (fees, limits).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after modifying `openapi.yaml`.
- Always run `pnpm --filter @workspace/db run push` after modifying the DB schema.
- Do not call service ports directly — use `localhost:80/api/...` (the shared proxy).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
