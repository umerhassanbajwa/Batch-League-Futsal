# Batch 2025 League

A live football league site: group tables, fixtures and results, and a knockout bracket.
Everyone can view it. Only organisers who sign in can enter scores.

- Site: plain HTML, CSS and JavaScript, hosted free on GitHub Pages.
- Data: a free Supabase project (Postgres). Scores appear for everyone within seconds.
- Security: the database itself only accepts changes from emails you list as organisers.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `styles.css` | The page and its look |
| `league.js` | League rules: standings, fixtures, knockout bracket |
| `app.js` | Screens, organiser sign in, saving scores |
| `config.js` | **Your Supabase URL and key go here** |
| `supabase/schema.sql` | Creates the tables and the security rules |
| `supabase/seed-existing-teams.sql` | Optional: your 8 teams from the Claude version |

## Setup (about 15 minutes)

### 1. Create the database

1. Go to supabase.com, sign up and click **New project**. Pick any name and a region near you. Save the database password somewhere.
2. Open **SQL Editor**, click **New query**, paste all of `supabase/schema.sql`, and click **Run**. It should say success.
3. Optional: run `supabase/seed-existing-teams.sql` the same way to load your 8 existing teams.

### 2. Create the organiser login

1. Go to **Authentication > Users > Add user > Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**. Repeat for any other organiser.
2. Go to **Authentication** settings (Sign In / Providers) and turn **off** "Allow new users to sign up". This stops strangers creating accounts.
3. In **SQL Editor**, run this once per organiser (use the same email as above):

```sql
insert into public.admins (email) values ('you@example.com');
```

Only emails in this list can change data. A signed-in user who is not in it can still only read.

### 3. Connect the site

1. In Supabase, open **Project Settings > API** (it may be called Data API or API Keys).
2. Copy the **Project URL** and the **anon public** key into `config.js`.
3. The anon key is meant to be public. Never put the `service_role` key anywhere.

### 4. Try it on your computer (optional)

```
python3 -m http.server 8000
```

Open http://localhost:8000 in your browser.

### 5. Put it online with GitHub Pages

1. Create a new public repository on GitHub, for example `batch-league`.
2. Upload all the files here (keep the `supabase` folder), or push them with git.
3. In the repo, open **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and Save.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/batch-league/`. Share that link with the batch.

## Running the league

1. Open the site, scroll to the bottom and click **Organiser sign in**.
2. In **Manage**, add teams to groups (A to D). Two groups of four works best.
3. Click **Create group fixtures**, then **Create knockout bracket**.
4. In **Fixtures**, click **Enter score** on a match. You can set the date at the same time.
5. The bracket fills itself in once each group has finished. Drawn knockout matches ask for a penalty result.

## Good to know

- Free Supabase projects can pause after a week with no activity. If the site shows an error, open the Supabase dashboard and click **Restore project**.
- Ranking is points, then goal difference, then goals scored. There is no head-to-head tiebreak yet.
- The knockout bracket supports two groups (semi-finals and final) or four groups (quarter-finals onward).
- To start over, use **Erase everything** in Manage.
