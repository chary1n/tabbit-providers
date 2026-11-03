# Add Tabbit as a provider (live catalog, cycle usage, daily check-in)

Tabbit is the AI browser at [web.tabbit.com](https://web.tabbit.com). This adds
it to magpie and OpenCode as the provider `tabbit`.

Uses Tabbit's own web API with the sign-in its browser already keeps — **no
browser automation**. A turn is the same three calls the app makes:

```
POST /api/v3/chat/rooms                → a room (the conversation)
POST /api/v3/chat/rooms/<room>/runs    → the turn
POST /api/v3/chat/rooms/<room>/join    → text/event-stream
```

**Provider id:** `tabbit` — no magpie built-in has that id, so nothing is
replaced.

## Sign-in

The `token` cookie: an RS256 JWT from `web.tab-browser.com`, valid 7 days.

- **Read Tabbit Browser sign-in (macOS)** — reads
  `~/Library/Application Support/Tabbit Browser/Default/Cookies`, decrypts the
  `token` cookie with the login keychain's `Tabbit Browser Safe Storage`
  password (AES-128-CBC, Chromium `v10`). The database is copied before it is
  read, so the browser does not have to be closed.
- **Paste Tabbit token** — for Windows and for profiles kept elsewhere. A bare
  JWT or a whole `k=v; k=v` cookie string both work; the account id is read out
  of the token's own `sub`.

There is no refresh endpoint; a 401 marks the account and one more click of the
first method fixes it.

## Models

`GET /proxy/v1/model_config/models?a=0&scene=chat` — the account's own catalog.
**A model's id is the catalog's `display_name`, verbatim**
(`DeepSeek-V4.1-Flash`, `GLM-5.3-Flash`, …), because that is the name a turn is
asked with.

- `supports_images` → image input; `support_thinking` → the reasoning flag
  (thinking arrives as `reasoning_content`)
- `hidden` rows are dropped; **Free models only** leaves out `premium_only`
  (a premium model otherwise answers `403` code `492`)
- **Client tool calls are off** (`toolcall: false`): the catalog's
  `supports_tools` is Tabbit's own server-side tools (browser, search), not
  tools an agent declares — measured; a client-declared tool is refused with
  "no such tool"
- Tabbit publishes no context limits; the two implied by a model's own
  description are set, everything else takes a default (`TABBIT_CONTEXT`,
  `TABBIT_OUTPUT`)

## Usage and check-in

- `GET /api/commerce/quota/v1/usage` → the cycle's allowance, shown as
  **Cycle usage** (a percentage with its reset date)
- `auth.checkin` reads
  `GET /api/commerce/activity/v1/sign-in/status?scene_codes=desktop_pet` first
  (free, and it says whether the activity is open), and only claims with
  `POST /api/commerce/activity/v1/sign-in` when the day is unsigned.
  `signed_today` → **done** without a claim; `signed` → **claimed**;
  `already_signed` → **done**; an unseen `sign_in_result` → **failed** with
  Tabbit's own word for it, never guessed as a claim. `desktop_pet` is the only
  scene the service accepts.

## Limits worth knowing

- One turn at a time (`maxConcurrency: 1`); first text takes seconds.
- A room keeps the conversation, so a follow-up in the same magpie session
  sends only the new message; a transcript that doesn't continue the room gets
  a fresh room with the whole transcript flattened into one prompt.
- A turn cut short is reported as `finish_reason: "length"`, not as a whole
  answer.

## Tests

44 offline tests: `node --test tests/` (a stubbed Tabbit, a recorded SSE turn,
a synthetic Chromium cookie blob). `bun scripts/check.mjs tabbit` passes.
