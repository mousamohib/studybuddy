# StudyBuddy

An AI study app for university and college students: upload a syllabus and course files, and it sets up the semester with a calendar, study plan, tutor, cheat sheets and practice papers.

- `app/`: the Expo app (iOS, Android, web), Expo SDK 57 so it runs in **Expo Go**
- `supabase/migrations/`: the database (tables, privacy rules, limits)
- `supabase/functions/ai`: the tutor (streaming answers, reshaping an answer, memory and revisit list)
- `supabase/functions/process-file`: reads uploaded files (PDF, PowerPoint, Word, zip, code, notebooks, photos) and outlines them
- `supabase/functions/jobs`: background work (syllabus setup, prof messages, study plan, weekly/exam/derivation sheets, practice papers)
- `supabase/functions/delete-account`: deletes a user's files and account
- `supabase/functions/_shared`: plan limits, model tiers, cost tracking, prompts, demo mode

## Build progress

| Step | What | Status |
| --- | --- | --- |
| 1 | Foundation: tabs, sign-in, database, AI gateway with limits, paywall placeholder | Done |
| 2 | Courses and files: uploads, readers, outlines, assignment tabs | Done |
| 3 | Syllabus setup, study plan, calendar sync, notifications | Done |
| 4 | Tutor: course chats, teaching styles, reshape any answer, memory, revisit list | Done |
| 5 | Exam prep: weekly sheets, exam and derivation sheets, practice papers, share and download | Done |
| 6 | Polish for friends: onboarding, legal pages, report button, data export | Done |
| Later | Group project memory, Apple/Google sign-in, real payments, push notifications from the server | |

## One-time setup (about 15 minutes)

You need Node.js 20+ on your laptop and the **Expo Go** app on your phone.

### 1. Create the database

Supabase dashboard → **SQL Editor** → **New query** → paste all of `supabase/migrations/0001_init.sql` → **Run**. Then do the same with `0002_tutor_and_sharing.sql`. Run them in that order, once each.

### 2. Sign-in settings (for testing)

Supabase → **Authentication** → **Sign In / Providers** → **Email**. While testing, you can turn off **Confirm email** so new accounts work straight away. Turn it back on before inviting other people.

### 3. Connect the app

Supabase → **Project Settings** → **API**. Copy the **Project URL** and the **anon / publishable key** (never the service role / secret key).

```bash
cd app
cp .env.example .env    # then paste the two values into .env
npm install
```

### 4. Deploy the server functions

```bash
npx supabase login
npx supabase link --project-ref uueawkqexfisdfsgibwf
npx supabase functions deploy ai
npx supabase functions deploy process-file
npx supabase functions deploy jobs
npx supabase functions deploy delete-account
```

With no AI key set, everything runs in **demo mode**: files are really read and outlined, syllabus dates are picked out, and the study plan is really built, but tutor answers, sheets and papers are sample text. It costs nothing and still counts usage, so limits can be tested.

### 5. Run it on your phone

```bash
cd app
npx expo start
```

Scan the QR code with the Camera app (iPhone) or Expo Go (Android). Press `w` in the terminal to open the web version.

### 6. Share links (optional)

Share links point to the web version. Once it's hosted (for example `npx expo export --platform web` and upload the `dist` folder to Netlify or Vercel), add `EXPO_PUBLIC_WEB_URL=https://your-site` to `app/.env`. Until then, Share shows a message instead of a link; Download works without it.

### Things to know when testing in Expo Go

- Reminders are local notifications scheduled on the phone (daily plan at 8:30, deadlines, exam countdowns). Push notifications from the server need a full app build.
- Calendar sync adds a separate "StudyBuddy" calendar on the phone. It is phone-only, not web.
- Dates are typed as `YYYY-MM-DD HH:MM`.
- Big files take a little while: each server task can run for about 150 seconds on Supabase's free plan.

## Email codes (sign-up confirmation and password reset)

The app uses 6-digit codes instead of email links, so it works inside the phone app. In Supabase → **Authentication** → **Emails** (Templates):

- **Confirm signup**: replace the body with `<h2>Your StudyBuddy code</h2><p>Enter this code in the app: <strong>{{ .Token }}</strong></p>`
- **Reset password**: replace the body with `<h2>Reset your StudyBuddy password</h2><p>Enter this code in the app: <strong>{{ .Token }}</strong></p>`

Supabase's built-in email sender only allows a few emails an hour. Before inviting people, connect your own sender under **Authentication → SMTP** (Resend or Postmark have free tiers).

## Live updates while Claude works

Clone the repo (`git clone https://github.com/mousamohib/studybuddy.git studybuddy-live`), copy your `app/.env` into it, run `npx expo start` in `app`, then in a second terminal run:

```
powershell -ExecutionPolicy Bypass -File scripts\live.ps1     # Windows
./scripts/live.sh                                            # Mac
```

It pulls new changes every 10 seconds and the app refreshes itself. If it says new packages were added, restart `npx expo start`.

## Turning on real AI (later)

1. Create an Anthropic API account, add a small amount of prepaid credit, and set a **monthly spend limit** in its console.
2. Store the key as a Supabase secret, never in the app or in Git:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... AI_MODE=live
```

Optional secrets (defaults in `supabase/functions/_shared/limits.ts`):

| Secret | Purpose | Default |
| --- | --- | --- |
| `AI_MODEL_FAST` / `_STANDARD` / `_STRONG` | Model per tier | claude-haiku-5-5 / claude-sonnet-5-5 / claude-sonnet-5-5 |
| `AI_PRICE_<TIER>_IN` / `_OUT` | USD per million tokens, for cost tracking | rough estimates; set real prices |
| `AI_MONTHLY_BUDGET_USD` | Stop all AI when the app's monthly spend reaches this | 50 |
| `USER_MONTHLY_COST_USD_FREE` / `_PRO` | Per-user monthly AI cost cap | 0.5 / 8 |

## Payments (placeholder)

`app/app/paywall.tsx` has a `startPurchase()` placeholder. The real flow (RevenueCat in the app, Stripe on the web) must set `plan = 'pro'` on the user's row in the `subscriptions` table **from the server** (a webhook), then the app calls `refresh()`. Users can read but never write that table.

## Plan limits

Defined in `supabase/functions/_shared/limits.ts` (enforced on the server) and mirrored in `app/lib/limits.ts` (meters in the app). New accounts get a 7-day Pro trial.

| Each month | Free | Pro |
| --- | --- | --- |
| Courses | 2 | Unlimited |
| File uploads | 7 | 200 |
| Tutor messages | 20 | 1,500 |
| Weekly revision sheets | 4 | Unlimited |
| Exam and derivation sheets | 1 | 10 |
| Practice papers | 1 | 20 |
