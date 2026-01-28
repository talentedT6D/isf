# AIFilms MVP - Setup Guide

## Quick Start (Local Demo)

The MVP works immediately in local mode - no setup needed!

### Run the Demo

1. Open a terminal and navigate to the mvp folder:
   ```bash
   cd /Users/adenjohngomes/Documents/work/AIfilms/mvp
   ```

2. Start a local server (pick one):
   ```bash
   # Option 1: Python (built into macOS)
   python3 -m http.server 8080

   # Option 2: Node.js (if you have it)
   npx serve .

   # Option 3: PHP (if you have it)
   php -S localhost:8080
   ```

3. Open in browser:
   - Main page: http://localhost:8080
   - Control Panel: http://localhost:8080/control.html
   - Audience Vote: http://localhost:8080/vote.html
   - Judge Panel: http://localhost:8080/judge.html
   - Results: http://localhost:8080/results.html

### Test the Sync

1. Open **Control Panel** in one browser tab
2. Open **Audience Vote** in another tab (or on your phone via same WiFi)
3. Click "Next" in Control Panel
4. Watch the Vote screen update instantly!

> **Note:** Local sync uses BroadcastChannel API - works across tabs in the SAME browser.
> For cross-device sync (phone + laptop), you need Supabase.

---

## Supabase Setup (For Production)

### Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Sign up with GitHub (easiest)
3. Click "New Project"
4. Fill in:
   - **Name:** `aifilms`
   - **Database Password:** (save this somewhere!)
   - **Region:** Pick closest to your event location
5. Wait ~2 minutes for project to spin up

### Step 2: Get Your Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon/public key:** `eyJhbGc...` (the long one)

### Step 3: Update sync.js

Open `mvp/sync.js` and update these lines at the top:

```javascript
const SYNC_MODE = 'supabase';  // Change from 'local' to 'supabase'

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...YOUR_KEY_HERE';
```

### Step 4: Enable Realtime

1. In Supabase dashboard, go to **Database** → **Replication**
2. Make sure Realtime is enabled (it should be by default)

That's it! No database tables needed for the broadcast feature.

---

## Database Setup (Optional - For Persistent Votes)

If you want votes saved to database (not just localStorage):

### Create Tables

Go to **SQL Editor** in Supabase and run:

```sql
-- Reels table
CREATE TABLE reels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contestant_name TEXT NOT NULL,
  email TEXT,
  category TEXT NOT NULL,
  video_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID REFERENCES reels(id),
  voter_id TEXT NOT NULL,
  voter_type TEXT NOT NULL, -- 'judge' or 'audience'
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reel_id, voter_id) -- One vote per person per reel
);

-- Enable Row Level Security
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read reels
CREATE POLICY "Reels are viewable by everyone"
  ON reels FOR SELECT
  USING (true);

-- Allow anyone to insert votes
CREATE POLICY "Anyone can vote"
  ON votes FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read votes
CREATE POLICY "Votes are viewable by everyone"
  ON votes FOR SELECT
  USING (true);
```

---

## Deployment Options

### Option 1: Cloudflare Pages (Recommended)

1. Push code to GitHub
2. Go to https://pages.cloudflare.com
3. Connect your repo
4. Deploy settings:
   - Build command: (leave empty)
   - Output directory: `mvp`
5. Deploy!

Your site will be at: `your-project.pages.dev`

### Option 2: Vercel

1. Push to GitHub
2. Import at https://vercel.com
3. Deploy

### Option 3: Netlify

1. Drag & drop the `mvp` folder at https://netlify.com/drop

---

## Free Tier Limits

### Supabase Free Tier
- ✅ 500MB database
- ✅ 2GB bandwidth/month
- ✅ 50,000 monthly active users
- ⚠️ **200 concurrent Realtime connections**

### If You Need More Connections

For 300-500 audience members, upgrade to **Supabase Pro ($25/month)**:
- 500 concurrent Realtime connections
- Instant upgrade, no downtime

---

## Troubleshooting

### "Sync not working between devices"

1. Make sure you're using Supabase mode (not local)
2. Check browser console for errors
3. Verify your Supabase URL and key are correct
4. Make sure both devices have internet

### "Votes not saving"

1. Check browser localStorage isn't full
2. Clear localStorage: `localStorage.clear()` in console
3. If using Supabase tables, check RLS policies

### "Control panel not broadcasting"

1. Check the connection status indicator
2. Refresh the page
3. Check console for WebSocket errors

---

## Files Overview

```
mvp/
├── index.html      # Landing page with links to all views
├── control.html    # Operator control panel (projector laptop)
├── vote.html       # Audience voting interface (phones)
├── judge.html      # Judge panel (judge phones)
├── results.html    # Live leaderboard
├── sync.js         # Real-time sync logic
└── SETUP.md        # This file
```
