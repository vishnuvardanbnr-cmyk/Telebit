---
name: Custom JWT auth (no Clerk)
description: How the platform handles auth after Clerk was removed — HMAC-SHA256 cookie tokens using SESSION_SECRET.
---

# Custom JWT Auth

Clerk was removed entirely. Auth is now custom cookie-based JWT.

## Token format
- `base64url(JSON { sub: userId, exp: timestamp }) + "." + HMAC-SHA256(payload, SESSION_SECRET)`
- Signed and verified in `artifacts/api-server/src/lib/auth.ts` (`signToken`, `verifyToken`)

## Cookie
- Name: `sid`
- HTTP-only, SameSite: lax, Secure in production, MaxAge: 30 days, Path: /

## Backend flow
- Login routes (`POST /api/auth/telegram`, `POST /api/auth/demo`) call `setAuthCookie(res, user.id)`
- `requireAuth` middleware reads `req.cookies.sid`, verifies token, looks up user by `id`, attaches `req.dbUser`
- Logout: `POST /api/auth/logout` calls `clearAuthCookie(res)`
- Optional auth in `GET /shop/products/:id/reviews`: manually reads `req.cookies.sid` via `verifyToken`

## Frontend
- `AuthProvider` (in `src/lib/auth-context.tsx`, both apps) wraps `useGetMe({ query: { retry: false } })`
- `useAuth()` → `{ user, isLoading, isSignedIn, signOut }`
- `ProtectedRoute` checks `isLoading` then `isSignedIn` before rendering
- No Bearer headers needed — cookies sent automatically on same-origin requests

## DB
- `users.clerkId` is now nullable; stores `tg_<telegramId>` for Telegram users, `demo_user_telebit` for demo
- Login routes look up by `clerkId OR email` to handle existing users and migrate old Clerk IDs

**Why:** Telegram auth handles identity directly; Clerk's sign-in token flow was broken in dev instances. Custom HMAC tokens avoid any external dependency for session management.
