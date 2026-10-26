# Scrawlie launch checklist

Status as of October 2026. Every core feature is built. What's left is mostly accounts, money and polish that only real use can finish.

## Must do before anyone outside friends uses it

| # | Item | Who | Notes |
|---|------|-----|-------|
| 1 | Turn on real AI | Mousa | Anthropic API key in Supabase secrets, a monthly spend limit in the Anthropic console, then test answer quality and real cost per student. Adjust limits in `_shared/limits.ts` if needed. |
| 2 | Payments | Friend | RevenueCat in the app (Apple and Google require their in-app purchase for digital subscriptions), Stripe on the web. A server webhook sets `plan = 'pro'` in `subscriptions`. Add "Restore purchases" and "Manage subscription". Hook-in point: `startPurchase()` in `app/app/paywall.tsx`. |
| 3 | Email sender | Mousa | Supabase's built-in email only sends a few per hour. Connect Resend or Postmark under Authentication → SMTP, and put the 6-digit code templates in place (see README). |
| 4 | Supabase paid plan | Mousa | The free plan pauses after a week without use, caps server tasks at about 150 seconds and has small storage. Move to Pro before launch. Check the project's region matches what the privacy policy says (Canada). |
| 5 | Legal review | Mousa | Privacy policy and terms are drafts. Add a contact email, have them checked for Quebec Law 25, PIPEDA and UK GDPR, and host them at a public URL (both stores ask for one). |
| 6 | Website | Mousa | Host the web version (Netlify, Vercel or EAS Hosting) with a domain, then set `EXPO_PUBLIC_WEB_URL`. Needed for share links, the privacy URL and a landing page. |
| 7 | Store accounts and builds | Mousa | Apple Developer Program (US$99/year), Google Play (US$25 once). Build with EAS (`npx eas-cli build`). New personal Google Play accounts need a closed test with 12 testers for 14 days before going public. |
| 8 | Store listings | Mousa | Screenshots, description, age rating (17+ matches the app), Apple privacy labels and Google data-safety form. |
| 9 | Full test pass with real AI | Both | Large PDFs, scanned PDFs, zips, photos; several syllabuses at once; a real Brightspace/Canvas/Moodle calendar link; lecture captions; iPhone, Android and web; a whole week of using the plan. |
| 10 | Reminders on the website | Claude | The website has no reminders today (phone only). Add an email digest (daily plan + deadlines this week) before promoting a web-first launch. |
| 11 | Sign in with Google | Claude + Mousa | Students expect it; fewer drop-offs at sign-up. Needs a Google Cloud OAuth client. |
| 12 | Link previews and SEO | Claude | Page description, social share image and title so links posted on Instagram/TikTok/Discord look right. |
| 13 | Error tracking and analytics | Claude + Mousa | Sentry + PostHog (with a cookie notice for UK visitors) so you see crashes and where people drop off. |
| 14 | Name and domain | Mousa | Trademark search for "Scrawlie" in Canada (CIPO) and the UK (IPO), then buy the domain. |
| 15 | Lecture transcription (optional) | Mousa | OPENAI_API_KEY secret to turn uploaded audio into text (about $0.006/min). Without it, students upload captions files instead. |

## Should do soon after

- Crash and error reports (Sentry) and simple analytics (PostHog), so you see problems before users report them.
- A way to read reports: answers students flag go to the `reports` table; someone needs to look at them.
- Sign in with Apple and Google. If you add Google sign-in on iPhone, Apple requires Sign in with Apple too.
- Push notifications from the server (needs the store builds). Today, reminders are scheduled on the phone, which works but only when the app has been opened recently.

## Known limits of the current version

- Group project memory is per student: teammates don't share one project space yet.
- Phone-calendar sync and reminders work in the phone app only, not the website. (School calendar feeds work everywhere.)
- Recordings over 25 MB can't be transcribed; students upload captions or audio instead.
- No change-email or change-password screen yet (password reset by code works).
- Very large files can hit the server time limit on Supabase's free plan.
