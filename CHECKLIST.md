# Submission checklist

Every requirement from the Devpost page, the Official Rules, and the Qloo hackathon kit, with how we meet it.
Tick an item only after verifying it on the **production URL / public repo**, not locally.

Deadline: **Oct 31, 9:15 AM IST** (= Oct 30, 11:45 PM ET). Internal target: **Oct 29**.

## 1. Eligibility & project rules (Official Rules §3–4)
- [ ] Entrant is of age of majority and not in an excluded country (India: OK)
- [x] Project newly created during the Submission Period (repo history starts Oct 2026)
- [ ] Integrates the Qloo API **and** is an agentic tool / built on an agent framework (Vercel AI SDK tool-calling agent)
- [ ] Works the same as the text description says it does: no claimed feature that isn't live
- [ ] All third-party services used within their terms: OpenRouter, Vercel, OpenStreetMap tiles (**visible attribution required**), Leaflet (BSD)
- [ ] Original work, solely owned; open-source deps used per their licenses
- [ ] No Qloo logo or trademarks used beyond a plain "uses the Qloo API" mention
- [ ] All materials in English

## 2. Qloo API usage (developer guide + kit)
- [x] Base URL `https://hackathon.api.qloo.com`, never `api.qloo.com` or staging
- [x] Auth via `X-Api-Key` header only, never in a query string, Bearer token, or client-side code
- [ ] Key lives only in `.env` / Vercel env vars; the browser never calls Qloo directly
- [ ] Use `/search` (or `/v2/tags`) to get IDs, then pass them to `/v2/insights`; no legacy `/recommendations`
- [ ] Bounded retries, no bulk scraping; results cached server-side (allowed)
- [ ] **Quota: 5 req/s and 10,000 req/month** (from response headers, Oct 9). Qloo enforces these with 429s; our obligation is bounded retries, no bulk scraping, and not wasting the monthly budget. One brief is about 10 calls. The monthly window resets around **Nov 8**, in the middle of judging, so keep October dev usage under about 5k and leave the rest for judges. Saved briefs are re-read from the database, not re-queried. Ask in #api-help on Discord for more if needed.
- [ ] **No Qloo response data committed to the public repo** (`.gitignore` blocks `*.qloo.json`; no fixtures)
- [ ] UI states that results are aggregate affinities, not an individual's identity, preferences, or future behaviour

## 2b. Accounts & user data (added with login)
- [ ] **One-click "Explore as guest"** on the landing page; no feature a judge needs sits behind a sign-up (guest flow click-tested Oct 10; landing CTA still goes via /login)
- [ ] Testing instructions on Devpost say "click Explore as guest" (rules: private sites must give access)
- [x] RLS enabled on every table; anon key only in the browser; no service-role key anywhere in the app (`npm run rls`: 19/19 attack checks pass incl. 12-way concurrent saves, Oct 10)
- [ ] Privacy note in the app: what we store (email or OAuth id, roster, saved briefs), and how to delete it
- [x] Delete-account / delete-data path works (DB: `npm run rls`; UI click-tested Oct 10)
- [ ] Supabase and OAuth providers (GitHub, Google) used within their terms; OAuth app names say "Gulliver", not Qloo

## 3. Required submission items (Devpost "What to Submit")
- [ ] **Functional demo link**: live, end-to-end, externally hosted (Vercel), no login needed
- [ ] Demo stays free and unrestricted **until judging ends (Nov 17, 10:15 AM IST)**: Vercel, OpenRouter credit, and Qloo key all alive
- [ ] **Public repo** (GitHub) with all source, assets, and run instructions
- [ ] **Open-source license** (MIT) `LICENSE` file, detected and **shown in the repo About section**
- [ ] About section: description + website = demo URL
- [ ] **Text description** on Devpost: features, functionality, and what makes it Qloo-powered
- [ ] If any page were private: test credentials in the instructions (N/A: no login)

## 4. Kit `docs/SUBMISSION.md` asks (README + Devpost)
- [ ] Problem statement
- [ ] Which Qloo endpoints / workflows were used, and why
- [ ] Redacted walk-through from request to result, including entity and tag choices
- [ ] Demo / screenshots with **no credentials or personal data** visible
- [ ] Setup steps from a clean environment (`git clone` → `.env` → `npm i` → `npm run dev`)
- [ ] Known limitations: what results do and don't establish

## 5. Judging criteria: evidence for each (equal weight; ties broken in this order)
- [ ] **Tech Implementation**: 6+ Qloo capabilities used correctly; "Under the hood" drawer shows real requests; code non-trivial and clean
- [ ] **Design**: complete flow (landing → brief → follow-up chat → share/PDF); mobile works; loading, empty, and error states
- [ ] **Potential Impact**: named audience (independent promoters, venues, talent agents) and a specific problem (cold-start tour routing)
- [ ] **Quality of Idea**: LLM-only vs Qloo comparison proves it fails without Qloo (Stage One "reasonably applies the APIs")
- [ ] Judges may judge **only from text + images**: screenshots must tell the story on their own; optional short video

## 6. Final pre-submit sweep (Oct 29)
- [ ] `node --env-file=.env scripts/smoke.ts <prod-url>` passes
- [ ] Incognito desktop + phone run of every preset
- [ ] No key *values* in history: `git log -p | grep -E "sk-or-v1-[A-Za-z0-9]{8}|_API_KEY=[^[:space:]]+"` is empty
- [ ] No env files in history: `git log --all --name-only --format= | grep -E "^\.env" | grep -v "^\.env\.example$"` is empty
- [ ] Devpost submitted (not just a draft) before the deadline; confirmation email received
