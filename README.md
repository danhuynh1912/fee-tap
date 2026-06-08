# 💸 FEETAP — Fee + Tap

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

## 🔒 Security notes

Writes (`club_settings`, `club_members`, `session_logs`, `clubs.plan`) are gated
by RLS to the club **owner** (`owner_id = auth.uid()`). Reads stay open so members
get a transparent dashboard and the forecasting cross-query can tally the roster.
The Free/Pro plan is persisted to `clubs.plan`; the VietQR payment is **mocked**
for demonstration and performs no real charge.
