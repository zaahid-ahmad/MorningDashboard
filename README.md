# Morning Dashboard

A single-page dashboard showing your **weather**, **commute traffic**, and **today's calendar events** in one glance every morning.

- **Frontend:** plain HTML/CSS/JS, no build step, deployed free on GitHub Pages.
- **Backend:** [Supabase](https://supabase.com) — Auth (Google sign-in) + Edge Functions + Postgres, all on its free tier.

All real secrets (OpenWeatherMap key, TomTom key, Google OAuth client secret) live only in Supabase's Edge Function secrets — never in this repo, never in the browser. The one thing that *is* in the repo (`js/config.js`) is your Supabase project URL and its public "anon" key, which are meant to be public — see the note at the top of that file.

---

## 1. Prerequisites

- [VS Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/downloads)
- A free [GitHub](https://github.com/) account
- A free [Supabase](https://supabase.com) account
- A free [Google Cloud](https://console.cloud.google.com/) account (for the Calendar OAuth client)
- [Node.js](https://nodejs.org/) (used only to install the Supabase CLI)
- A modern browser

The page must be served over `http://`, not opened as a `file://` path — it uses JavaScript ES modules, which browsers block from the filesystem. Section 9 covers a one-line local server.

---

## 2. Get the project into VS Code

1. Create a folder, e.g. `morning-dashboard`, and open it in VS Code (`File > Open Folder...`).
2. Unzip the project Claude sent you into this folder so it matches:

   ```
   morning-dashboard/
   ├── index.html
   ├── style.css
   ├── README.md
   ├── LICENSE
   ├── .gitignore
   ├── js/
   │   ├── main.js
   │   ├── auth.js
   │   ├── config.js
   │   ├── supabaseClient.js
   │   ├── settings.js
   │   ├── weather.js
   │   ├── traffic.js
   │   └── schedule.js
   └── supabase/
       ├── schema.sql
       └── functions/
           ├── _shared/cors.ts
           ├── get-weather/index.ts
           ├── get-commute/index.ts
           ├── get-schedule/index.ts
           └── store-google-token/index.ts
   ```

3. Open the integrated terminal: `Terminal > New Terminal` (or `` Ctrl+` ``).

---

## 3. Create your Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Pick an org, name it (e.g. `morning-dashboard`), set a database password (save it somewhere), pick a region close to you, create it. Wait ~1-2 minutes for provisioning.
3. Once it's ready, go to **Project Settings → Data API**. Note down:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon / public key**

You'll paste both into `js/config.js` in Section 8.

---

## 4. Set up the Google Cloud OAuth client

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a new project (or reuse one).
2. Search for **"Google Calendar API"** and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External**.
   - Fill in app name, support email, developer contact.
   - Under **Test users**, add your own Google account — while the app is in "Testing" mode, only listed accounts can sign in, which is fine for a personal project.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URIs** — add exactly one:
     ```
     https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
     ```
     (use the Project URL from Section 3; this is Supabase's callback, not your GitHub Pages URL — Supabase sits between your app and Google for this flow)
   - Leave "Authorized JavaScript origins" empty — not used by this flow.
5. Click **Create**. Copy the **Client ID** and **Client Secret** — you'll need both twice: once in Supabase's dashboard (Section 5) and once as an Edge Function secret (Section 7).

---

## 5. Turn on Google sign-in in Supabase

1. In your Supabase project dashboard, go to **Authentication → Sign In / Providers → Google**.
2. Toggle it on. Paste in the **Client ID** and **Client Secret** from Section 4.
3. Save.

This lets `supabase.auth.signInWithOAuth({ provider: 'google' })` work from the frontend — Supabase handles the redirect dance with Google for you.

---

## 6. Run the database schema

1. In Supabase, go to **SQL Editor → New query**.
2. Paste in the contents of `supabase/schema.sql` from this repo and click **Run**.

This creates one small table (`user_google_tokens`) that stores each signed-in user's Google refresh token server-side, with Row Level Security on and no client-facing policies — only the Edge Functions (using the service-role key) can read or write it.

---

## 7. Get your free weather/traffic API keys

### OpenWeatherMap
1. Sign up at <https://home.openweathermap.org/users/sign_up>.
2. Copy your default key from <https://home.openweathermap.org/api_keys>. New keys can take **up to ~2 hours** to activate.

### TomTom
1. Sign up at <https://developer.tomtom.com/user/register>.
2. Create an API key in the developer dashboard (Routing API + Search API).

---

## 8. Install the Supabase CLI and deploy the backend

From the VS Code terminal, inside `morning-dashboard`:

```bash
npm install -g supabase
supabase login
```

This opens a browser to authorize the CLI once.

**Link this folder to your Supabase project** (find your project ref in the Supabase dashboard URL, or under Project Settings → General):
```bash
supabase link --project-ref YOUR-PROJECT-REF
```

**Set the secrets your Edge Functions need** (all four, real values from Sections 4 and 7):
```bash
supabase secrets set OWM_API_KEY=your_openweathermap_key
supabase secrets set TOMTOM_API_KEY=your_tomtom_key
supabase secrets set GOOGLE_CLIENT_ID=your_google_client_id
supabase secrets set GOOGLE_CLIENT_SECRET=your_google_client_secret
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically inside every Edge Function — you don't set those yourself.)

**Deploy the four functions:**
```bash
supabase functions deploy get-weather
supabase functions deploy get-commute
supabase functions deploy get-schedule
supabase functions deploy store-google-token
```

---

## 9. Configure and run the frontend locally

1. Open `js/config.js` and fill in the two values from Section 3:
   ```js
   export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   export const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
   ```
2. Serve the folder over `http://` — pick one:
   ```bash
   python3 -m http.server 5500
   ```
   or install the VS Code **Live Server** extension and right-click `index.html` → "Open with Live Server".
3. Open the page, click **Sign in with Google** (top right), approve access (including the Calendar scope) with the Google account you added as a test user in Section 4.
4. Click the gear icon and fill in your home/work addresses and departure times.

Everything should now populate: weather, commute, and today's schedule.

---

## 10. Push to GitHub and deploy with GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit: morning dashboard"
git branch -M main
```

Create an empty repo at [github.com/new](https://github.com/new) (name it `morning-dashboard`, don't initialize it with anything), then:
```bash
git remote add origin https://github.com/YOUR-USERNAME/morning-dashboard.git
git push -u origin main
```

**Enable GitHub Pages:** repo → **Settings → Pages** → Source: "Deploy from a branch" → Branch: `main`, folder: `/ (root)` → **Save**. Your site goes live in a minute or two at:
```
https://YOUR-USERNAME.github.io/morning-dashboard/
```

**Future changes:**
```bash
git add .
git commit -m "Describe what changed"
git push
```
GitHub Pages redeploys automatically after each push to `main`.

---

## Project structure

```
index.html                          Page markup: three cards + Settings modal + top-bar sign-in
style.css                           All styling
js/config.js                        Your Supabase URL + anon key (public, safe to commit)
js/supabaseClient.js                Shared Supabase client
js/auth.js                          Google sign-in (redirect flow) + refresh-token handoff
js/settings.js                      Home/work address + departure times (localStorage)
js/weather.js / traffic.js / schedule.js   Call the Edge Functions below, render each card
supabase/schema.sql                 The one table this app needs
supabase/functions/get-weather      OpenWeatherMap proxy
supabase/functions/get-commute      TomTom geocoding + routing proxy
supabase/functions/get-schedule     Refreshes your Google token, fetches today's events
supabase/functions/store-google-token   Persists your Google refresh token (called once at sign-in)
```

## How the Google sign-in stays "logged in"

Google issues two kinds of token: a short-lived **access token** and a long-lived **refresh token**. `js/auth.js` asks for both (`access_type=offline`, `prompt=consent`) and immediately hands the refresh token to the `store-google-token` function, which saves it server-side — the browser never holds onto it. From then on, `get-schedule` uses that stored refresh token to mint a fresh access token on every call, so your calendar keeps working without you signing in again. If you ever explicitly revoke access (Google Account → Security → Third-party access), just sign in again from the dashboard.

## Troubleshooting

- **"Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js first"** — you haven't filled in Section 9 step 1 yet.
- **Sign-in redirects to Google then shows an error** — double check the redirect URI in Google Cloud (Section 4) is exactly `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`, and that Google is toggled on with the right Client ID/Secret in Supabase (Section 5).
- **Weather/commute cards show an error after signing in** — check the Edge Function secrets are set (Section 8) and that you deployed all four functions. `supabase functions logs get-weather` shows recent errors.
- **Schedule says "Google Calendar isn't connected yet"** — the refresh token wasn't captured (e.g. you signed in before this backend was deployed, or without the consent prompt). Sign out and back in.
- **OpenWeatherMap key errors right after creating it** — keys can take up to ~2 hours to activate.
- **Only your own Google account can sign in** — expected while the Google OAuth consent screen is in "Testing" mode (Section 4); that's fine for a personal project. Add more test users there if needed, or publish the app in Google Cloud for anyone to use.

## Security notes

- `js/config.js` (Supabase URL + anon key) is meant to be public — access control happens in the Edge Functions and RLS, not by hiding this file.
- Every Edge Function checks for a real signed-in Supabase user before doing anything, so a stranger reading your public repo/page can't use it to burn your API quotas.
- The `user_google_tokens` table has RLS on with zero client-facing policies — it's reachable only from the Edge Functions via the service-role key, which never leaves Supabase's servers.

## License

MIT — see [LICENSE](LICENSE).
