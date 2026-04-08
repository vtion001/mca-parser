# Path 1: Auth & Session Flow

## CALL_FLOW_TRACE

### Login Sequence (Entry: user submits login form)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                                            │
│                                                                              │
│  LoginPage.tsx:handleSubmit                                                  │
│    1. POST /auth/login {email, password}                                   │
│       via authApi.login() → api.post('/auth/login')                        │
│       Input: { email: string, password: string }                           │
│       Output: { success: bool, data?: { user, token }, error?: string }    │
│                                                                              │
│  api.ts (interceptor response)                                              │
│    2. On success: localStorage.setItem('api_token', token)                 │
│                  localStorage.setItem('account_id', String(account_id))     │
│    3. LoginPage stores user in localStorage as 'user' JSON                 │
│                                                                              │
│  Token storage locations:                                                    │
│    - localStorage['api_token']    → Bearer token string                     │
│    - localStorage['account_id']   → account_id as string                    │
│    - localStorage['user']         → JSON {id, name, email, account_id}      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND (Laravel)                                                           │
│                                                                              │
│  AuthController::login (AuthController.php:44)                              │
│    Input: $request->validate(['email', 'password'])                         │
│    1. $user = User::where('email', $email)->first()                        │
│    2. if (!$user || !Hash::check($password, $user->password)) → 401        │
│    3. $token = $user->regenerateToken()                                     │
│       - User::regenerateToken(): bin2hex(random_bytes(32)) → 64-char hex   │
│       - saves to $this->api_token                                           │
│    Output: { success: true, data: { user {...}, token: string } }           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Authenticated Request Sequence (all subsequent requests)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                                            │
│                                                                              │
│  api.ts request interceptor (api.ts:14)                                     │
│    1. const token = localStorage.getItem('api_token')                      │
│    2. const accountId = localStorage.getItem('account_id')                  │
│    3. config.headers.Authorization = `Bearer ${token}`                     │
│    4. config.headers['X-Account-ID'] = accountId                           │
│                                                                              │
│  API call: e.g., documentApi.getAll() → api.get('/documents')             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND - AuthMiddleware (AuthMiddleware.php:14)                            │
│                                                                              │
│  1. $token = $request->bearerToken()                                       │
│     Input: Authorization header                                             │
│     Output: token string or null                                            │
│                                                                              │
│  2. if (!$token) → 401 { success: false, error: 'Unauthenticated.' }       │
│                                                                              │
│  3. ensureEmulatedPrepares()                                               │
│     - Sets PDO::ATTR_EMULATE_PREPARES = true (fixes PgBouncer issue)       │
│                                                                              │
│  4. $user = User::where('api_token', $token)->first()                      │
│     Input: token string                                                     │
│     Output: User model or null                                              │
│                                                                              │
│  5. if (!$user) → 401 { success: false, error: 'Unauthenticated.' }        │
│                                                                              │
│  6. $request->attributes->set('user', $user)                              │
│     $request->setUserResolver(fn () => $user)                               │
│     Output: User attached to request                                        │
│                                                                              │
│  Passes to next middleware                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND - AccountMiddleware (AccountMiddleware.php:13)                      │
│                                                                              │
│  1. $user = $request->user()                                               │
│     Input: from AuthMiddleware                                              │
│     Output: User model                                                      │
│                                                                              │
│  2. if (!$user) → 401 { success: false, error: 'Unauthenticated.' }       │
│                                                                              │
│  3. $headerAccountId = $request->header('X-Account-ID')                    │
│                       ?? $request->query('account_id')                     │
│                                                                              │
│  4. If no header or invalid:                                                │
│       $request->attributes->set('account_id', $user->account_id)          │
│       $request->attributes->set('account', $user->account)                │
│       → allows access to own account without header                        │
│                                                                              │
│  5. If header provided:                                                     │
│       if ($user->account_id !== $accountId) → 403                          │
│       Log: warning with user_id, user_account_id, requested_account_id   │
│                                                                              │
│  6. $account = Account::where('id', $accountId)->where('is_active', 't') │
│     if (!$account) → 403 { success: false, error: 'Invalid account.' }    │
│                                                                              │
│  7. $request->attributes->set('account_id', $account->id)                │
│     $request->attributes->set('account', $account)                        │
│                                                                              │
│  Passes to controller                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Logout Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                                    │
│  main.tsx:handleLogout                                                      │
│    1. authApi.logout() → api.post('/auth/logout')                          │
│    2. localStorage.removeItem('api_token')                                  │
│    3. localStorage.removeItem('account_id')                                │
│  LoginPage.tsx (separate component) uses same pattern                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND                                                                     │
│  AuthController::logout (AuthController.php:76)                             │
│    1. $user = $request->user()                                             │
│    2. $user->clearToken() → sets api_token = null                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FAILURE_MODES

### Step-by-step failure analysis

| Step | Failure | Error Returned | Handling |
|------|---------|----------------|----------|
| Login: validation | Missing/invalid email format | 422 (Laravel default) with validation errors | Yes - Laravel validation |
| Login: user lookup | Email not found | 401 `{ success: false, error: "Invalid credentials." }` | Yes |
| Login: password check | Wrong password | 401 `{ success: false, error: "Invalid credentials." }` | Yes |
| Login: token regenerate | Database write failure | 500 (Laravel exception) | No - unhandled |
| AuthMiddleware: no token | No Authorization header | 401 `{ success: false, error: "Unauthenticated." }` | Yes |
| AuthMiddleware: invalid token | Token not in DB | 401 `{ success: false, error: "Unauthenticated." }` | Yes |
| AuthMiddleware: PDO failure | DB connection error | 500 (Laravel exception) in ensureEmulatedPrepares catch | Partial - empty catch |
| AccountMiddleware: no header | Omitted X-Account-ID | 200 OK, uses user's own account_id | Yes - design choice |
| AccountMiddleware: cross-account | Header account_id != user's | 403 `{ success: false, error: "Invalid account access." }` | Yes |
| AccountMiddleware: account inactive | Account not active | 403 `{ success: false, error: "Invalid account access." }` | Yes |
| Logout: no user | Not authenticated | 200 `{ success: true, message: "Logged out successfully." }` | Yes - no-op logout |

### Specific failure concerns

1. **Token never expires**: The `api_token` is a 64-char hex string with no TTL. Once issued, it remains valid until explicitly cleared via logout or DB update. No `expires_at` column exists.

2. **Race condition on token reuse after delete**: If a user is deleted from the DB while their token is still valid (stored by attacker or stale client), `User::where('api_token', $token)->first()` will return null and return 401. This is handled correctly.

3. **Password hash rehash edge case**: `User::setPasswordAttribute` uses `Hash::needsRehash()` which could produce inconsistent hashes if Laravel's hash config changes, but this is Laravel's own behavior.

4. **No token rotation on each login**: `regenerateToken()` generates a new token but the old token remains valid until the next login. Concurrent sessions all remain valid.

5. **No brute-force protection**: No rate limiting on login attempts documented. An attacker could brute-force credentials with no lockout.

6. **Missing X-Account-ID returns 200**: When the header is omitted, AccountMiddleware silently uses the user's own account. This means a client that forgets to send the header will get unexpected 200 responses for data belonging to the wrong account (only if the user belongs to multiple accounts, but currently each user has exactly one account_id).

7. **PDO exception swallowed**: `ensureEmulatedPrepares()` catches all exceptions with an empty catch block, allowing queries to proceed even if PDO configuration fails.

---

## TESTING_REQUIREMENTS

### Mock requirements

| Component | What to mock | How |
|-----------|-------------|-----|
| User model | `User::where('api_token', $token)->first()` | Mock User model, return user or null |
| Account model | `Account::where('id', $accountId)->where('is_active', 't')->first()` | Mock Account, return active/inactive/null |
| Hash::check | Password verification | Return true or false |
| DB connection | `DB::connection()->getPdo()` | Mock PDO for ensureEmulatedPrepares |
| Log facade | `Log::warning`, `Log::debug` | Assert logging calls |

### Test data fixtures

```php
// Valid user fixture
$validUser = [
    'id' => 1,
    'account_id' => 100,
    'name' => 'Test User',
    'email' => 'test@example.com',
    'password' => Hash::make('password123'),
    'api_token' => 'valid-token-64-chars-hex-string-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
];

// Valid account fixture
$validAccount = [
    'id' => 100,
    'is_active' => 't',
];

// Inactive account fixture
$inactiveAccount = [
    'id' => 200,
    'is_active' => 'f',
];
```

### Specific test cases to write

#### AuthMiddlewareTest
1. `test_missing_bearer_token_returns_401` - no Authorization header → 401
2. `test_valid_token_sets_user_on_request` - valid token → user attached, 200 passed through
3. `test_invalid_token_returns_401` - token not in DB → 401
4. `test_token_lookup_is_case_sensitive` - ensure exact token match
5. `test_pdo_emulate_prepares_is_set` - verify PDO attribute set on connection
6. `test_pdo_exception_in_ensureEmulatedPrepares_is_handled` - connection failure doesn't crash middleware

#### AccountMiddlewareTest
1. `test_no_header_uses_user_account_id` - null header → user's own account_id set on request
2. `test_invalid_header_numeric_or_zero_rejected` - non-numeric or <= 0 header → uses user's own account
3. `test_valid_header_matching_user_account_grants_access` - header matches user → 200
4. `test_header_account_id_mismatch_returns_403` - wrong account → 403 with warning log
5. `test_inactive_account_returns_403` - account exists but is_active = false → 403
6. `test_account_not_found_returns_403` - account ID doesn't exist → 403
7. `test_query_string_account_id_also_works` - ?account_id=100 in URL is accepted

#### AuthControllerTest
1. `test_login_with_valid_credentials_returns_token` - email+password correct → 200 with user+token
2. `test_login_with_invalid_email_returns_401` - email not found → 401
3. `test_login_with_wrong_password_returns_401` - Hash::check fails → 401
4. `test_login_token_is_64_hex_chars` - regenerateToken called, token length = 64
5. `test_login_previous_token_is_revoked` - old token replaced by new one
6. `test_logout_clears_token` - clearToken called, api_token set to null
7. `test_register_creates_user_with_token` - registration flow creates user + token
8. `test_me_returns_current_user` - /auth/me returns user data

#### Integration tests
1. `test_full_login_flow_stores_token_in_localStorage` - frontend integration (JS test)
2. `test_authenticated_request_with_stored_token_succeeds` - full flow test
3. `test_401_response_clears_localStorage_and_redirects` - frontend logout on 401
4. `test_concurrent_logins_all_tokens_valid` - two logins create two valid tokens simultaneously

---

## HIGH_RISK_ISSUES

### From Phase 1 audit files

**FRONTEND_ISSUE_LOG #16 (Medium)**:
> `localStorage` user stored without expiry/monitoring: User session stored in `localStorage` by `LoginPage` with no expiry check, no token refresh, and no monitoring for tampering.

**Location**: `LoginPage.tsx:29` (also `main.tsx:39`)
**Risk**: Session never expires. If token is stolen, attacker has indefinite access. No token rotation on login.
**Fix needed**: Add token TTL, implement token refresh, or switch to httpOnly cookie-based auth.

**BACKEND_ISSUE_LOG #5 (Low - "Known limitation")**:
> `ExtractionController::fullExtract()` defaults `account_id` to 1 when not present - single-tenant fallback is a design decision but risky

**Location**: `ExtractionController.php:29`
**Risk**: If X-Account-ID header is missing and this controller doesn't go through AccountMiddleware, it defaults to account 1. This could cause cross-tenant data access.
**Note**: This is a different controller than the auth flow, but the missing header pattern is relevant.

### Additional issues identified in this deep-dive

1. **No brute-force/rate-limiting on login** (Risk: High) - Login endpoint accepts unlimited attempts with no lockout, no CAPTCHA, no progressive delays.

2. **Token stored in localStorage (XSS risk)** (Risk: High) - `api_token` in localStorage is accessible to JavaScript. Any XSS vulnerability exposes the token immediately. httpOnly cookies would mitigate this.

3. **No token refresh mechanism** (Risk: High) - Token never expires. To revoke, user must change password or logout everywhere. No "logout all devices" feature.

4. **Empty catch in ensureEmulatedPrepares** (Risk: Medium) - `AuthMiddleware.php:60-62` catches and swallows all exceptions silently. Database errors during connection setup will not be surfaced properly.

5. **No monitoring/alerting on failed auth** (Risk: Medium) - `AccountMiddleware` logs warnings on cross-account access but there's no alerting. Repeated 401s from brute-force won't trigger alarms.

6. **No "remember me" or session extension** (Risk: Low) - Sessions are essentially permanent. No way to have short-lived sessions that extend on activity.

7. **No multi-account support in frontend** (Risk: Low) - Users belong to one account. The `X-Account-ID` header is present but the frontend always sends the user's single `account_id`. No account switcher UI.

---

## TOKEN_LIFECYCLE

```
[Login]
    │
    ▼
regenerateToken() ──► api_token = bin2hex(random_bytes(32))  [64 hex chars]
    │                    saves to DB immediately
    │
    ▼
Token sent to client via /auth/login response
    │
    ▼
Token stored in localStorage['api_token'] + localStorage['account_id']
    │
    ▼
[Every API request] ──► AuthMiddleware: User::where('api_token', $token)->first()
    │                      │
    │                      ▼
    │                    User found ──► AccountMiddleware ──► Controller
    │                    User NOT found ──► 401 "Unauthenticated."
    │
    ▼
[Logout] ──► clearToken() ──► api_token = null  (DB save)
             Frontend also clears localStorage
```

**Key invariant**: Every authenticated request queries the DB for the user by token. There is no in-memory session cache. This means:
- Each request hits the database.
- Token revocation is immediate (next request fails).
- No distributed session store needed (but also no session invalidation broadcast across instances).
