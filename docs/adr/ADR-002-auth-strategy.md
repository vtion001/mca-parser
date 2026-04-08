# ADR-002: Authentication Strategy

**Status:** Accepted (with known limitations)
**Date:** 2026-04-08
**Deciders:** MCA PDF Scrubber team

---

## Context

MCA PDF Scrubber is a multi-tenant SaaS application. We need to authenticate users on every API request and enforce account-level isolation. The frontend is a React SPA (Single Page Application).

Constraints:
- Multi-tenancy via `X-Account-ID` header
- Stateless authentication (no server-side session)
- SPA frontend with no SSR
- Deployment on Docker (nginx reverse proxy on port 8000)

---

## Decision

**Static Bearer token stored in `localStorage`.**

### Token Format

- Generated at login: `bin2hex(random_bytes(32))` → 64-character hex string
- Stored in `users.api_token` column (VARCHAR, no expiry column)
- Returned to client on login, stored in `localStorage['api_token']`
- Sent on every request: `Authorization: Bearer <token>`
- Never expires unless manually revoked via logout or DB update

### Authentication Middleware Chain

```
1. AuthMiddleware (validates token exists in DB)
   └─ AccountMiddleware (validates X-Account-ID matches user.account_id)
       └─ Controller
```

### Client-Side Storage

```typescript
// On login success
localStorage.setItem('api_token', token);
localStorage.setItem('account_id', accountId);
localStorage.setItem('user', JSON.stringify(user));
```

Axios interceptor sends on every request:
```typescript
config.headers['Authorization'] = `Bearer ${localStorage.getItem('api_token')}`;
config.headers['X-Account-ID'] = localStorage.getItem('account_id');
```

On 401 response:
```typescript
localStorage.removeItem('api_token');
localStorage.removeItem('account_id');
localStorage.removeItem('user');
window.location.href = '/';
```

---

## Alternatives Considered

### httpOnly Cookie + CSRF Token

**Rejected.** CSRF protection adds complexity. For a purely API-driven SPA, Bearer tokens are simpler. Cookies also complicate cross-origin deployments behind nginx.

### JWT (JSON Web Tokens)

**Rejected for now.** JWTs were considered but:
- No built-in revocation (would need a denylist anyway)
- Larger token size per request
- More complex implementation for a small team
- Static tokens are simpler to debug and trace

### OAuth2 / OIDC (e.g., Auth0, Supabase Auth)

**Rejected for MVP.** External identity providers add external dependency risk. We implemented our own auth to minimize third-party failure modes. Can migrate later.

---

## Known Issues with Current Strategy

### Issue 1: No Token Expiry (HIGH)

Tokens have no TTL. If compromised, attacker has indefinite access.

**Impact:** Any XSS or network interception grants permanent access until the token is manually revoked in the DB.

**Current workaround:** Users must manually log out to revoke. Admins can revoke via `UPDATE users SET api_token = NULL WHERE id = ?`.

**Planned fix:** Add `token_expires_at` column (TIMESTAMP). Token refresh endpoint returns new token before expiry. Old token invalidated on refresh.

---

### Issue 2: XSS Risk via localStorage (HIGH)

`localStorage['api_token']` is accessible to all JavaScript on the page. Any XSS vulnerability (e.g., a React injection, a malicious dependency) can immediately exfiltrate the token.

**Impact:** XSS → token theft → account takeover.

**Current workaround:** Content Security Policy (CSP) headers in nginx (not yet configured).

**Planned fix:** Migrate to httpOnly `SameSite=Strict` cookie. JavaScript has no access to the cookie, so XSS cannot read the token. Requires `SameSite=Strict` + `Secure` (HTTPS-only).

---

### Issue 3: No Brute-Force Protection (HIGH)

`POST /api/v1/auth/login` and `POST /api/v1/auth/register` have no rate limiting. An attacker can attempt unlimited password guesses.

**Impact:** Account takeover via credential stuffing or brute force.

**Current workaround:** None.

**Planned fix:** Add Laravel `throttle` middleware to auth routes: `Route::middleware('throttle:5,1')` (5 attempts per minute per IP). Consider CAPTCHA after 3 failed attempts.

---

### Issue 4: No Token Rotation on Login (MEDIUM)

On login, the old token remains valid. A user can log in from multiple devices and all tokens work simultaneously.

**Impact:** Cannot force logout of old sessions. Compromised token on one device remains valid even after password change.

**Current workaround:** None.

**Planned fix:** On login, invalidate all prior tokens for that user (`UPDATE users SET api_token = NULL WHERE user_id = ?` then create new).

---

### Issue 5: No "Logout Everywhere" (MEDIUM)

Users cannot invalidate all their sessions at once.

**Current workaround:** Admin sets `api_token = NULL` for the user in the DB.

**Planned fix:** Token families — each login creates a new token family member; "logout everywhere" invalidates the entire family.

---

## Migration Path to httpOnly Cookie Auth

When implementing the planned fix for Issue 2, the migration would be:

1. Add `token_expires_at` and `token_family` columns to `users` table
2. Create `POST /auth/refresh` endpoint that returns a new token (httpOnly cookie) when presented with a valid Bearer token
3. Frontend stores token in a httpOnly cookie instead of localStorage
4. Remove Bearer token header from Axios interceptor; browser sends cookie automatically
5. Remove localStorage auth storage; keep `localStorage['user']` only (non-sensitive data)
6. Add CSRF cookie endpoint for non-browser clients to retrieve initial CSRF token

---

## Summary of Risks and Mitigations

| Issue | Severity | Current Mitigation | Planned Fix |
|-------|----------|-------------------|-------------|
| No token expiry | HIGH | Manual DB revocation | `token_expires_at` + refresh endpoint |
| localStorage XSS | HIGH | None (CSP not configured) | httpOnly SameSite=Strict cookie |
| No brute-force protection | HIGH | None | `throttle` middleware |
| No token rotation | MEDIUM | None | Invalidate prior tokens on login |
| No "logout everywhere" | MEDIUM | Admin DB update | Token families |

---

## Related Architecture Decisions

- **Multi-tenancy enforcement** is done via `X-Account-ID` header, not JWT claims. This allows any valid token to be used for any account the user belongs to (by sending the correct header). This is intentional but requires client discipline to always send the correct header.
- **Supabase PostgreSQL** is used for user/account persistence. The `api_token` column has no index beyond the primary key on `id`, so token lookups do a table scan. For high-volume deployments, add a unique index on `api_token`.
