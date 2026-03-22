# Code review — 2026-03-22

## Scope
- Reviewed authentication/session handling, storage/security behavior, API client layering, and analytics normalization logic.

## Findings

### 1) High: token extraction is overly permissive and can persist wrong values
- In `findToken`, **any nested string** longer than 20 chars and without spaces is treated as a token.
- This can accidentally persist unrelated IDs/hash values from evolving backend payloads and create hard-to-debug auth states.
- Recommendation:
  - Stop heuristic fallback for arbitrary strings.
  - Parse only explicit keys (`token`, `accessToken`, etc.), optionally within known envelopes (`data`, `auth`, `session`).
  - Add contract tests against real/recorded login/register payload variants.

### 2) High: insecure token fallback to `localStorage`
- If `expo-secure-store` is unavailable, secrets fall back to `localStorage`.
- This increases exposure to XSS token theft in web builds and may violate stricter security requirements.
- Recommendation:
  - For auth tokens, prefer **httpOnly secure cookies** on web and avoid localStorage.
  - If fallback is required, gate it behind explicit env flag and emit telemetry so insecure mode is visible.

### 3) Medium: auth bootstrap can stay in loading state on rejection
- `useAuth` initialization uses `Promise.all(...).then(...)` without `catch/finally`.
- Any rejection leaves `isLoading: true` forever and may produce unhandled promise rejection noise.
- Recommendation:
  - Wrap in `try/catch/finally` (or `.catch(...).finally(...)`) and always clear loading state.

### 4) Medium: optimistic signed-in decision for stale tokens
- `isSignedIn()` returns `true` immediately if local token exists, without server check.
- If token is expired/revoked, app may briefly route user as authenticated then bounce later.
- Recommendation:
  - Treat token-only state as `"unknown"` until `/auth/me` (or refresh) confirms validity.
  - Alternatively decode expiry claim and pre-check `exp` before declaring authenticated.

### 5) Medium: day-level analytics are timezone-sensitive (UTC vs local)
- Date keys are derived via `toISOString().slice(0, 10)` in multiple helpers.
- This can shift “today” and day-bucket series around local midnight for non-UTC users, affecting product metrics and user trust in analytics.
- Recommendation:
  - Normalize using backend timezone or explicit app timezone utility.
  - Keep date math in one shared helper with tests for UTC± offsets and DST boundaries.

### 6) Medium: duplicated API client entry points increase divergence risk
- There are multiple wrappers/re-exports (`src/services/api-client.ts`, `src/utils/apiClient.ts`) over `src/lib/apiClient.ts`.
- Error mapping differs (`UNAUTHORIZED` conversion exists only in one wrapper), creating subtle behavior differences by import path.
- Recommendation:
  - Standardize on a single public API client module.
  - Keep adapter/wrapper logic isolated and explicit per runtime, not per random import path.

## Business-impact improvements
- Define explicit auth/session states (`anonymous | checking | authenticated | expired`) to reduce bounce/friction and improve onboarding conversion.
- Tighten token contract (typed payload schema validation) to prevent silent auth regressions after backend payload changes.
- Revisit analytics timezone definition in product requirements, so KPI dashboards and in-app numbers align.

## Suggested next steps (priority)
1. Harden token parsing and storage policy (High).
2. Fix auth bootstrap error handling and stale-token session check (Medium).
3. Centralize API client surface and add timezone-safe analytics utilities/tests (Medium).
