# 💸 SPOFUND

**The financial forecasting & fund-management engine for sports clubs.**

A standalone, production-grade React app that runs on its own domain but shares
**one Supabase project** with [PollTap](../poll-tap). Members sign in with
**Google OAuth 2.0**; the host forecasts court + shuttlecock costs for the
billing cycle, watches the club fund, and splits any shortfall fairly across the
live roster pulled from PollTap's membership poll.

Built with **React + Vite + Tailwind + Lucide**, **Supabase (Auth + Postgres +
Realtime)**, and **i18n (English / Tiếng Việt)**.

---

## ✨ Features

- **Google OAuth 2.0** via Supabase Auth — host vs. read-only member roles.
- **Freemium paywall** — Free plan caps the roster at **15 members** and locks
  advanced forecasting + Excel/PDF export; **Pro** unlocks everything.
- **Mock VietQR upgrade** — `99,000 ₫/mo`, auto-confirms after 3s for demos.
- **Forecasting engine** — court cost, shuttlecock boxes (`ceil(sessions × balls
  / 12)`), total projected cost for a `month` (4w) or `quarter` (12w) cycle.
- **Ecosystem cross-query** — reads PollTap `votes (vote_type='membership_cycle')`
  + `responses` to derive the **Dynamic Fixed Member Count**.
- **Fund runway alert** — red banner on a deficit with the exact per-member top-up.
- **Post-session actuals log** — variance vs. the estimate, with an over-usage warning.
- **i18n** — English & Vietnamese, toggle in the nav (persisted to `localStorage`).
- **Shared design DNA** — identical Volt-green / Deep-slate system as PollTap.

---

## 🚀 Setup

### 1. Database
Run **PollTap's** `supabase/schema.sql` first (creates `clubs` / `votes` /
`responses`), then run this app's [`supabase/schema.sql`](supabase/schema.sql)
to add `club_settings`, `club_members`, `session_logs` and extend the shared
tables (`clubs.owner_id`, `clubs.plan`, `votes.vote_type`).

### 2. Google OAuth
In **Supabase → Authentication → Providers → Google**, enable Google and add
your OAuth client ID/secret. Add this app's URL to the **Redirect URLs**
(`http://localhost:5192` for dev).

### 3. Credentials
```bash
cp .env.example .env   # fill with the SAME Supabase project as PollTap
```
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 4. Run
```bash
npm install
npm run dev      # → http://localhost:5192
```

Build for production: `npm run build` (output in `dist/`). Deploys to Vercel
(`vercel.json` handles the SPA rewrite); Netlify fallback in `public/_redirects`.

---

## 🧮 Forecasting math

Sessions come from the **real calendar**. The host picks which weekdays the club
plays (`play_weekdays`, `0=Sun … 6=Sat`); FeeTap counts how many of each weekday
fall inside the billing period:

- **Month** mode → the calendar month containing today.
- **Quarter** mode → the 3-month window (aligned to `quarter_start_month`)
  containing today; handles year rollover.

```
totalSessions  = Σ (count of each play weekday across the period's months)
courtCost      = courtPricePerHour × hoursPerSession × totalSessions
boxes          = ceil(totalSessions × estShuttlecocks / 12)
shuttleCost    = boxes × pricePerBox
totalCost      = courtCost + shuttleCost
balance        = currentFund − totalCost
perMember      = balance < 0 ? ceil(−balance / memberCount) : 0
```

The dashboard runs this for the **current** period *and* the **next** period
(next month / next quarter) so the club can budget ahead. If no play days are set
yet, it falls back to a weekly estimate (`sessionsPerWeek × 4 × months`).

`memberCount` is the PollTap membership-poll tally when one exists, otherwise the
length of the FeeTap registration list.

---

## 💳 PayOS payment integration

SPOFUND supports per-club bank transfer collection via [PayOS](https://payos.vn) (VietQR). Each club host registers their own PayOS account and enters their keys in Settings — money goes directly to their bank account.

### Setup (per club)
1. Register at payos.vn and create a payment channel.
2. In **Club Settings → PayOS**, enter **Client ID**, **API Key**, **Checksum Key**.
3. In the PayOS Dashboard, set the webhook URL to:
   ```
   https://<supabase-project>.supabase.co/functions/v1/payos-webhook
   ```

### How it works
- Host opens a **payment collection** for an upcoming billing period → system creates a `payment_collections` row and one `member_payment_records` row per member.
- Fee per member is computed **live** from the forecast engine (not stored statically) — adjusts automatically when member count or settings change.
- Member taps **Pay with QR** → Edge Function `create-payment` generates a PayOS payment link with the current live fee.
- After bank transfer, PayOS calls the webhook → `confirm_member_payment` RPC marks the member as paid and appends an entry to the fund ledger.
- If the modal is open when payment is confirmed, it transitions to a success screen and auto-closes after 7 seconds.

### Key design decisions
| Decision | Reason |
|---|---|
| `club_has_payos()` SECURITY DEFINER | Members can't read `club_payment_config` (RLS protects API keys), but need to know if PayOS is configured to show the QR button |
| `liveAmount` passed to Edge Function | `member_payment_records.amount` can be stale; always use the live-computed fee |
| QR cache invalidated on amount change | Prevents member paying wrong amount when member count changes mid-collection |
| Webhook verifies with per-club checksum key | Multi-tenant — each club has its own PayOS account |
| Actual PayOS `d.amount` written to DB before RPC | Fund ledger records what was actually transferred, not what was expected |
| `--no-verify-jwt` on webhook function | PayOS has no Supabase JWT; security comes from HMAC signature verification instead |

---

## 🔒 Security notes

Writes (`club_settings`, `club_members`, `session_logs`, `clubs.plan`) are gated
by RLS to the club **owner** (`owner_id = auth.uid()`). Reads stay open so members
get a transparent dashboard and the forecasting cross-query can tally the roster.
The Free/Pro plan is persisted to `clubs.plan`; the VietQR payment is **mocked**
for demonstration and performs no real charge.
