# AI Studio: project brief (handover for a new chat)

> Paste or attach this whole file at the start of a new chat. It explains what Mousa wants to build, what's already decided, what's still open, and the context from earlier work.
> Status as of 28 Oct 2026: **planning finished, nothing built yet.** Next step is Stage 1 (see the end).

---

## 1. The goal in one paragraph

Mousa wants an automated "AI studio": a team of AI agents with **two production lines that bring in money in two different ways**.
- **Website line:** about **one new website a week**. The bots research the idea, build it, test it, deploy a demo, then take it live, and finally make the marketing videos.
- **YouTube line:** the bots find trending video topics, write scripts and make finished videos for a YouTube channel.

Mousa approves at key checkpoints and does anything that needs his ID, his card or his accounts. The whole thing must be **as cheap and as simple as possible**. A "cute office/city view" of the bots working is a nice-to-have dashboard, built last.

---

## 2. Who does what

**Mousa does:**
- picks ideas and approves at each checkpoint
- tests the demo websites
- sets up payments (Stripe links)
- buys domains for winning sites (needs his card)
- **posts and uploads all marketing and YouTube videos himself**; the bots never post
- adds music to videos himself (or sends an MP3 and the bots sync it)

**The bots do everything else:** research, specs, design, coding, testing, deploying demos, connecting domains, going live, analytics, legal pages, videos, scripts, captions, thumbnails and posting plans.

**Other people:** Mousa's friend in the UK handles payments (his Stripe account, from the Scrawlie project).

---

## 3. The team: 6 agents

| Agent | Job |
|---|---|
| **Leader** | Runs both lines, keeps a weekly schedule and status board, asks Mousa for approvals, enforces budgets |
| **Researcher** | Two modes: (a) website ideas, (b) YouTube niches, trending topics and outlier videos |
| **Builder** | Writes a short spec and design mock-up, then builds the website from the shared starter kit |
| **Scriptwriter** | YouTube: hook, structure, full script, shot list, titles, thumbnail concepts |
| **Video maker** | Shared by both lines: website promo videos and full YouTube videos plus Shorts |
| **Reviewer / Tester** | Clicks through websites (screenshots, bugs, "vibecoded" look); watches videos frame by frame (mistakes, facts, boring stretches) |

Idle agents cost nothing. You pay only per use (tokens), so there's no need to "shut agents down".

---

## 4. Website line: the flow

1. **Researcher** ranks about 5 ideas with evidence: real complaints and demand, competitors, how easy each is to build. → ✅ **Mousa picks one**
2. **Builder** writes a spec and design mock-up. → ✅ **Mousa approves the look**
3. **Builder + Tester** build a **landing page + waitlist + demo video first** ("test before building"). Only ideas with sign-ups become full apps.
4. A demo goes up on a **free Netlify preview link**. → ✅ **Mousa tests and approves** (approval = merging the GitHub pull request)
5. Bots go live: connect the URL (a sub-address of the studio domain, or the site's own domain for winners), analytics, legal pages, link previews. **Mousa adds the payment link.**
6. **Video maker** makes the promo videos (vertical + landscape), captions, hashtags and a posting plan. → ✅ **Mousa approves and posts**
7. The Leader sends a **weekly scoreboard**: visits, sign-ups and views per idea, so ideas get doubled down on or killed.

Existing idea already shortlisted (stage-2 approved): **"What's Your Student Email Worth?"** You enter a uni email domain and country and see the total $ value of free student perks, plus a checklist for claiming them.

---

## 5. YouTube line: the flow

1. The **Researcher** scans the niche every day or two using the **YouTube Data API** (free, with a daily usage limit). It finds **outlier videos**: posted in the last 7–30 days and getting far more views than that channel normally gets (about 5–10× the channel's average), which means the topic or packaging caused the views.
2. For each one it works out **why it worked** (title formula, thumbnail, hook, length, structure) and scores **how replicable it is** (can our engine make the style with original or free visuals, with no copyrighted footage or characters, within a 2–4 day turnaround).
3. It pitches **"our version"**: same topic, but our own angle, script, visuals and a better thumbnail, with an urgency label. → ✅ **Mousa ticks the ones he wants**
4. **Scriptwriter** writes the script and shot list. → ✅ **Mousa approves the script**
5. **Video maker** produces:
   - an 8–12 minute video with voiceover, animated visuals, charts, the mascot host, free stock footage and captions
   - 2–3 thumbnails, plus a title, description and tags
   - **3–5 Shorts** cut from the long video
6. **Reviewer** checks it. → ✅ **Mousa approves and uploads**

**Mix:** about 1 trend video + 1 evergreen video a week, plus Shorts.

**Voice options:** Mousa's own voice (best for monetization), a free local AI voice on his PC, or a paid AI voice (a few $ per video).

### Niche decision (still open)
Mousa is considering **anime recaps** ("the whole story of Naruto in 10 min") or **business-world content**. He wants the niche chosen by: trending now, good views, and whether the style and thumbnails can easily be replicated by AI.

**Key finding: anime recaps are high-risk.**
- They need copyrighted clips or characters, which means copyright claims, strikes and demonetization.
- Generating the characters doesn't fix it, and the assistant won't draw known characters.
- They also look like "reused content" to YouTube.
- A safer version: anime-*industry* analysis with no clips (e.g. "how Crunchyroll makes money").

**Recommended: business stories** ("How Nike…", "Why Blockbuster died", "Rise and fall of WeWork").
- Everything can be made with animated timelines, charts, maps, counters and a narrator mascot.
- No copyright risk, and advertisers usually pay much more per view than in entertainment niches.
- It also pairs well with the websites.

### Researcher's niche scoring checklist
Trending (rising views, new channels breaking through) · typical views per video · competition · **replicable visual style** · **replicable thumbnail template** · **copyright safety (hard fail)** · monetization safety (each video adds real value) · ad value · synergy with the websites.

Output: the top 3–5 niches, each with example channels and numbers, a video template, a mock thumbnail, 10 starter ideas and the risks.

### YouTube rules to respect
- **Monetization (YouTube Partner Program):**
  - Now: 1,000 subscribers + 4,000 watch hours in 12 months, or 10M Shorts views in 90 days.
  - **From 1 Feb 2027 for new channels:** 1,000 subscribers + 8,000 watch hours, or 20M Shorts views in 90 days.
  - Expect months before ad revenue. Earn earlier through your own products, affiliate links and sponsors.
- **Inauthentic / reused content policy:** templated, mass-produced AI videos get demonetized. Each video needs a human-chosen angle, real value and some variety in format. The approval checkpoints are the human layer.
- **Copy topics and formats, never scripts, footage or thumbnails.**
- **Disclosure:** realistic synthetic media needs YouTube's "altered content" label. Animation and production help don't.

---

## 6. Hosting, databases and costs (researched Oct 2026)

**Hosting**
- **Netlify free plan** (Mousa's preferred host for demos):
  - 300 credits a month, shared across **all** sites, and commercial use is allowed
  - each production deploy costs **15 credits** (≈ 20 go-lives or updates a month in total)
  - bandwidth also uses credits (≈ 15 GB a month if spent only on that)
  - **when credits run out, every site goes offline until next month**
  - **deploy previews are free**
  - ⇒ demos always run as previews; production deploys only after approval, with updates batched
- **Cloudflare Pages free:** unlimited bandwidth, 500 builds a month, commercial use allowed. Recommended for live sites if there are several of them.

**Databases**
- **Supabase free:** only **2 active projects**, and free projects pause after a week of inactivity. ⇒ All test sites share **one** Supabase project; many sites need no database at all. A winner gets its own project.

**Domains**
- One **studio domain** (≈ $12 a year); every test site gets `ideaname.studio-domain.com`, set up fully automatically by the bots.
- Winners get their own domain: Mousa buys it, the bots connect it.

**Payments:** **Stripe Payment Links** (no checkout code). Mousa's friend creates the link and the bots embed it. A full subscription system only gets built for proven winners.

**AI costs**
- You pay per use. The Builder is the expensive part because building takes hundreds of small steps that re-read files.
- **Recommended setup:** Claude **Pro ($20/month)** for the build step (Mousa starts the build in Claude Code with one command, using the plan's limits) + **pay-as-you-go API** for the cheap steps (research, scripts, tests, captions).
- **Hands-off alternative:** **Claude Max 5x ($100/month)**, which includes **$100/month of API credits** for automated runs (Agent SDK / `claude -p`). You must be on the plan 7 days before claiming them, and they don't roll over.

**Cost-cutting rules (all agreed):**
1. Landing page + waitlist first; build a full app only after sign-ups.
2. One shared starter kit for every site: sign-up, database, payment slot, analytics, legal pages, link previews, admin panel, plus a few house design styles.
3. A cheap model for research, scripts and captions; the strong model only for code. Batch processing (≈ half price) for overnight research.
4. Small, fresh tasks (less context to re-read) and prompt caching.
5. **A budget cap per idea (e.g. $10) and at most 3 fix rounds** before the bots stop and ask Mousa.
6. Videos render locally on Mousa's PC for free. Free local AI models are OK for small text jobs, not for code.
7. Free analytics (Cloudflare Web Analytics or the PostHog free tier).

**Estimated cost**

| Item | Cost |
|---|---|
| Testing an idea (landing + waitlist + videos) | ≈ $3–8 |
| A full app for a winner | ≈ $20–50 |
| Each long YouTube video | ≈ $3–10 |
| Shorts | ≈ $0 |
| One site + 2 long videos a week | ≈ **$40–80 a month** pay-as-you-go, or mostly covered by Max ($100 flat); the Pro + pay-as-you-go setup is about $25–30 a month for the website line alone |
| Studio domain | ≈ $12 a year |
| Hosting, database, rendering | $0 |

---

## 7. How approvals work (cheap and simple)

Everything lives in **GitHub**.
- Each website is a pull request with a free Netlify **preview link**. Mousa reviews it, and clicking **Merge** is his approval; that also triggers going live.
- Idea, script and video approvals are GitHub issues with checkboxes, or a simple status page.
- The office/city dashboard (built last) just reads this status.
- **One human check before anything goes public**: no misleading claims, no competitors' trademarks.

---

## 8. Reusable pieces already built (from the Scrawlie project)

Repo **github.com/mousamohib/studybuddy** (the app is now called **Scrawlie**: an AI study planner for uni and college students in Canada and the UK).
- **Video engine** (built 27 Oct 2026), saved in the repo at **`marketing/video/`** (see its README):
  - a **3D sticky-note mascot** in three.js (expressions, arms, legs, peeling corner)
  - scenes in HTML/CSS, driven by a time-based `render(t)` function
  - rendered frame by frame with **Playwright**, then **ffmpeg** to MP4
  - **120 BPM beat grid** (beat = 0.5 s, bar = 2 s), so cuts sync to music
  - vertical **1080×1920** and landscape **1920×1080** from the same code
  - a click-track "BEATCHECK" version for checking sync
  - a planned feature: Mousa sends an MP3 → detect its beats → retime the video → mix the music in
  - style: green cutting-mat background, sticky notes, the handwritten font Caveat with Bricolage Grotesque and Figtree, a browser-window frame with 3D tilt, a fake cursor and clicks, speech bubbles, paper confetti
- **Website patterns that worked:**
  - Expo/React (web) + Supabase backend (edge functions, row-level security)
  - an admin dashboard: stats, users, give Pro, ban/delete, AI budget controls, audit log; admins are set by an `ADMIN_EMAILS` server secret
  - AI spending caps and a beta budget
  - school calendar (iCal) sync, bulk uploads, a hand-drawn icon set, a first-time tour
- **Windows helper:** a one-click `Start Scrawlie.bat` on the Desktop. It pulls from git, prompts for database migrations (copies the SQL and opens the Supabase editor), redeploys functions only when they changed, then starts the site.
  - `.gitattributes` fixes the Windows line-ending problems that blocked updates.
  - Pattern worth reusing for the studio.

---

## 9. Mousa's preferences (important for whoever builds this)

- **Hates the generic "vibecoded" AI look:** no generic rounded boxes, wants distinctive design (square corners and a paper/sticky-note theme worked for Scrawlie).
- Wants **plain, simple, numbered step-by-step instructions** with links, assuming no prior knowledge.
- He's on **Windows** (PowerShell). Prefers double-click scripts over typing commands.
- **Never paste API keys or secrets into chat.** He sets them himself (Supabase secrets, etc.).
- Cost-conscious: always show the cheapest option first.
- Lives in **Quebec, Canada** (Law 25 privacy rules apply); the friend handling payments is in the UK.

---

## 10. Build plan (agreed order)

| Stage | What gets built |
|---|---|
| **1** | Leader + GitHub approval flow + free hosting setup (Netlify previews, studio domain) + budget caps |
| **2** | Researcher: website mode **and** YouTube mode (niche report + outlier finder via the YouTube Data API) |
| **3** | Builder + Tester for websites, using the starter kit |
| **4** | Video maker: promos + long-form YouTube + voiceover + Shorts cutting (reusing the Scrawlie video engine) |
| **5** | Scriptwriter + Reviewer for the YouTube line |
| **6** | Bonus: the office/city dashboard showing the bots working |

Suggested first task in the new chat: **run the YouTube niche report + current outlier videos by hand** (business stories, tech history, brand rise-and-fall, money explained, safe anime-industry angle). Then use that report as the template for the automated Researcher.

## 11. Open decisions

1. **Studio name and domain** (for sub-addresses such as `ideaname.studio.com`).
2. **AI plan:** Pro + pay-as-you-go (cheapest; Mousa starts each build) vs. Max 5x (hands-off).
3. **Hosting for live sites:** stay on Netlify (watch credits) or use Cloudflare Pages for live sites.
4. **YouTube niche:** decide after the niche report.
5. **Voice:** Mousa's own voice vs. a free local AI voice vs. a paid AI voice.
6. **Accounts Mousa needs to create:** Netlify (personal access token saved as a secret), a new GitHub repo for the studio, a Google Cloud project for the YouTube Data API key, and later a YouTube channel.
