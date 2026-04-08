# Authentication & Authorization Runbook

## Token Lifecycle

### Token Issuance (Login)

```
POST /api/v1/auth/login
Body: { "email": "...", "password": "..." }

Response 200: { "success": true, "data": { "user": {...}, "token": "hex64string" } }
Response 401: { "success": false, "error": "Invalid credentials." }
Response 422: Validation error
```

On successful login:
1. `AuthController::login()` generates a new token: `bin2hex(random_bytes(32))` (64-char hex)
2. The token is stored in the `users.api_token` column (no expiry column exists)
3. The token is returned to the client and stored in `localStorage`

### Token Storage (Client)

```typescript
// LoginPage.tsx
localStorage.setItem('api_token', token);
localStorage.setItem('account_id', accountId);
localStorage.setItem('user', JSON.stringify(user));
```

All subsequent API requests include the token via an Axios interceptor:

```
Authorization: Bearer <token>
X-Account-ID: <account_id>
```

### Token Validation (Every Request)

```
1. AuthMiddleware::handle() reads bearer token from Authorization header
2. User::where('api_token', $token)->first() queries the database
3. If no user found → 401 "Unauthenticated."
4. User attached to request via $request->attributes->set('user', $user)
5. $request->setUserResolver(fn () => $user) allows lazy resolution
```

### Token Expiry

**Tokens currently never expire.** There is no `token_expires_at` column, no refresh mechanism, and no "logout all devices" capability. A token remains valid until manually revoked.

### Token Revocation (Logout)

```
POST /api/v1/auth/logout
Authorization: Bearer <token>

Response 200: { "success": true }
```

`AuthController::logout()` sets `users.api_token = NULL` for the authenticated user. The client clears localStorage.

---

## Multi-Tenancy Enforcement

### Header-Based Account Isolation

The `X-Account-ID` header identifies which account a request targets:

```
X-Account-ID: <account_id>
```

**Middleware stack (api.php):**
```
AuthMiddleware (validates token, attaches $request->user)
    └─ AccountMiddleware (validates X-Account-ID header)
        └─ Controller action
```

### AccountMiddleware Logic

| Scenario | Behavior |
|----------|----------|
| `X-Account-ID` header present and matches `user.account_id` | Request proceeds, account attached |
| `X-Account-ID` header present but mismatches `user.account_id` | 403 "Invalid account access." + warning log |
| `X-Account-ID` header absent | User's own `account_id` is used (permissive fallback) |
| `X-Account-ID` references inactive account (`is_active != 't'`) | 403 "Invalid account access." |
| Query-string `?account_id=` instead of header | Accepted as fallback (same behavior as missing header) |

**Note:** The permissive fallback (no header = use own account) is a known limitation. A token belonging to account B that omits the header will silently operate under account B, not account 1.

---

## Common Auth Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthenticated.` | Missing `Authorization` header or token not in DB | Include `Authorization: Bearer <token>` |
| `401 Unauthenticated.` (after valid login) | Token was revoked via logout | Re-login to get new token |
| `403 Invalid account access.` | `X-Account-ID` header doesn't match user's `account_id` | Send correct `X-Account-ID` header |
| `403 Invalid account access.` | Account exists but `is_active != 't'` | Activate account in database |
| `401` on all requests after browser refresh | localStorage was cleared (private browsing, clearing browser data) | Re-login |
| `401` intermittently | Multiple login devices without token rotation | Implement token families or re-login |

---

## Revoking a User's Token

### Single User (Self-Service)

```bash
# User logs out via the UI
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

### Single User (Admin/Forced Revocation)

Set the user's `api_token` to `NULL` directly in the database:

```sql
UPDATE users SET api_token = NULL WHERE id = <user_id>;
```

This immediately invalidates the token. The user must log in again to obtain a new token.

### All Sessions for a User (Logout Everywhere)

There is no built-in "logout everywhere" feature. As a workaround:

```sql
-- Generate a new token and notify user they must re-login
UPDATE users SET api_token = bin2hex(random_bytes(32)) WHERE id = <user_id>;
```

The user will be logged out of all devices on their next request.

---

## Security Considerations

### Current Weaknesses (Known Limitations)

1. **No token expiry** — Tokens live indefinitely. If compromised, attacker has permanent access.
2. **localStorage XSS risk** — `api_token` is accessible to JavaScript. Any XSS vulnerability exposes the token immediately.
3. **No brute-force protection** — Login endpoint has no rate limiting, CAPTCHA, or account lockout.
4. **No token rotation on login** — Old tokens remain valid after re-login (no invalidation of prior sessions).
5. **PDO exception swallowing** — `AuthMiddleware::ensureEmulatedPrepares()` silently catches PDO exceptions, which can obscure database connection failures as 401 errors.

### Planned Improvements

- Migrate to httpOnly SameSite=Strict cookie auth
- Add `token_expires_at` column with 24h expiry + refresh token rotation
- Add `throttle` middleware to `/auth/login` and `/auth/register`
- Invalidate prior tokens on login (token families)

---

## Middleware Flow Diagram

```
Browser Request
      │
      ▼
AuthMiddleware
  ├─ bearerToken() → null? → 401
  ├─ User::where(api_token, $token) → null? → 401
  ├─ ensureEmulatedPrepares() [catches PDO exceptions silently]
  └─ $request->user = User
           │
           ▼
AccountMiddleware
  ├─ X-Account-ID header absent? → use $user->account_id (permissive)
  ├─ X-Account-ID !== $user->account_id? → 403 + log warning
  ├─ Account::where(id, accountId).where(is_active, 't') → null? → 403
  └─ $request->account_id = accountId
           │
           ▼
Controller Action
```
