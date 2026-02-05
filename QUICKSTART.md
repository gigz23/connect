# 🚀 Quick Start Guide - PlaceConnect

## What You Have

A complete, production-ready location-based chat platform with:
- ✅ Interactive map with custom markers
- ✅ Real-time chat rooms per location
- ✅ Activity-based color indicators
- ✅ Mobile-responsive design
- ✅ No authentication required (MVP)
- ✅ Supabase backend (real-time + database)

## Get Started in 5 Minutes

### 1. Install Dependencies
```bash
cd placeconnect
npm install
```

### 2. Set Up Supabase (Free)
1. Go to https://supabase.com → Sign up
2. Create new project (wait ~2 minutes)
3. Go to **Settings** → **API**
4. Copy your `Project URL` and `anon/public key`

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-key-here
```

### 4. Create Database
1. In Supabase, click **SQL Editor**
2. Open `database/schema.sql`
3. Copy entire file
4. Paste in SQL Editor and click **Run**

This creates tables, sample data, and real-time subscriptions.

### 5. Enable Realtime
1. Go to **Database** → **Replication**
2. Enable for `places` and `messages` tables

### 6. Run the App
```bash
npm run dev
```

Open http://localhost:3000 🎉

## What to Customize

### 1. Add Your Own Locations
Edit `database/schema.sql` and add your places:

```sql
INSERT INTO places (name, type, latitude, longitude, address, description) VALUES
  ('Your School', 'school', 40.7128, -74.0060, '123 Main St', 'Description'),
  ('Favorite Cafe', 'cafe', 40.7129, -74.0061, '456 Oak Ave', 'Great coffee');
```

Get coordinates: https://www.latlong.net/

### 2. Change Map Center
Edit `src/components/MapView.jsx` line 15:
```javascript
mapInstanceRef.current = L.map(mapRef.current).setView([YOUR_LAT, YOUR_LNG], 13);
```

### 3. Customize Colors/Styling
- App colors: `src/App.css`
- Map markers: `src/components/MapView.css`
- Chat design: `src/components/ChatPanel.css`

## File Structure

```
placeconnect/
├── src/
│   ├── components/
│   │   ├── MapView.jsx          # Map with Leaflet
│   │   ├── ChatPanel.jsx        # Real-time chat
│   │   └── UsernameModal.jsx    # Username input
│   ├── lib/
│   │   └── supabase.js          # Database config
│   └── App.jsx                  # Main app
├── database/
│   └── schema.sql               # Database setup
├── README.md                    # Full documentation
├── DEPLOYMENT.md                # How to deploy
├── MOBILE_MIGRATION.md          # Convert to mobile app
└── ARCHITECTURE.md              # Technical details
```

## Next Steps

### Test It Out
1. Open in browser
2. Set a username
3. Click any marker on the map
4. Send a test message
5. Open in another browser tab
6. Watch real-time updates! 🎉

### Deploy to Production
```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_URL
git push -u origin main

# Deploy to Vercel (free)
1. Go to vercel.com
2. Import your GitHub repo
3. Add environment variables
4. Click Deploy
```

See `DEPLOYMENT.md` for detailed instructions.

### Convert to Mobile App
See `MOBILE_MIGRATION.md` for:
- React Native conversion (70% code reuse)
- Flutter option
- PWA setup (instant mobile install)

## Troubleshooting

**Map not showing?**
- Check internet connection
- Clear browser cache

**Messages not updating?**
- Check Supabase Replication is enabled
- Verify `.env` credentials
- Check browser console for errors

**Can't connect to database?**
- Double-check `.env` values
- Ensure Supabase project is running
- Check SQL Editor for errors

## Support

- Full docs: `README.md`
- Architecture: `ARCHITECTURE.md`
- Deployment: `DEPLOYMENT.md`
- Mobile: `MOBILE_MIGRATION.md`

## Key Features to Remember

✅ **Real-time by default** - messages appear instantly  
✅ **Activity indicators** - markers glow based on chat activity  
✅ **No server needed** - Supabase handles everything  
✅ **Mobile-ready** - responsive design works on all devices  
✅ **Scalable** - starts free, grows with you  

## What Makes This Special

1. **Location-first design** - not just another chat app
2. **Real-world use cases** - schools, cafes, parks, sports
3. **Zero friction** - no signup, just pick a username
4. **Instant community** - connect with people at specific places
5. **Future-proof** - easy to convert to native mobile app

---

Built with ❤️ for local communities

Now go customize it for your city! 🚀
