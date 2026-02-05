# PlaceConnect 🗺️💬

A location-based chat platform where users can join conversations happening at specific places (schools, cafes, parks, etc.) on an interactive map.

## 🎯 Concept

Inspired by TripBFF but adapted for local places:
- **Interactive map** showing nearby locations
- **Public chat rooms** for each place
- **Activity indicators** showing which places are active
- **Real-time messaging** using Supabase
- **No authentication required** - just pick a username and start chatting

## 🚀 Tech Stack

- **Frontend**: React + Vite
- **Map**: Leaflet (lightweight, free)
- **Backend**: Supabase (real-time database + auth ready)
- **Styling**: Vanilla CSS (easy to customize)
- **Deployment**: Vercel (frontend) + Supabase (backend)

## 📋 Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works great)
- Basic knowledge of React

## 🛠️ Setup Instructions

### 1. Clone and Install

```bash
cd placeconnect
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the database to be provisioned (~2 minutes)
4. Go to **Settings** → **API** and copy:
   - `Project URL`
   - `anon/public key`

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database

1. Go to your Supabase project
2. Click **SQL Editor** in the sidebar
3. Click **New Query**
4. Copy the entire contents of `database/schema.sql`
5. Paste and click **Run**

This creates:
- `places` table (stores locations)
- `messages` table (stores chat messages)
- Indexes for performance
- Real-time subscriptions
- Sample data (Tbilisi locations - customize for your area!)

### 5. Enable Realtime

1. In Supabase, go to **Database** → **Replication**
2. Enable replication for:
   - `places` table
   - `messages` table

### 6. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎨 Customizing Locations

Edit the sample data in `database/schema.sql`:

```sql
INSERT INTO places (name, type, latitude, longitude, address, description) VALUES
  ('Your School', 'school', 40.7128, -74.0060, '123 Main St', 'Description'),
  ('Local Cafe', 'cafe', 40.7129, -74.0061, '456 Oak Ave', 'Great coffee');
```

Place types available:
- `school`
- `university`
- `basketball_court`
- `cafe`
- `library`
- `park`
- `gym`
- `coworking`

Get coordinates from [latlong.net](https://www.latlong.net/)

## 📱 Features

### Current MVP Features
✅ Interactive map with custom markers  
✅ Real-time chat per location  
✅ Activity-based color coding  
✅ Online user count  
✅ Username-based identity (no signup required)  
✅ Mobile-responsive design  
✅ Animated markers with pulse effect  

### Roadmap for Full Version
🔲 User authentication (optional)  
🔲 Push notifications  
🔲 Private messaging  
🔲 User profiles  
🔲 Place ratings/reviews  
🔲 Photo sharing in chat  
🔲 Event scheduling per place  
🔲 Admin tools to add/edit places  

## 🏗️ Architecture

```
placeconnect/
├── src/
│   ├── components/
│   │   ├── MapView.jsx          # Leaflet map with markers
│   │   ├── ChatPanel.jsx        # Real-time chat interface
│   │   └── UsernameModal.jsx    # Username input
│   ├── lib/
│   │   └── supabase.js          # Supabase client config
│   ├── App.jsx                  # Main app component
│   └── main.jsx                 # Entry point
├── database/
│   └── schema.sql               # Database setup
└── package.json
```

## 📊 Data Model

### Places Table
- `id` - UUID (primary key)
- `name` - Place name
- `type` - Place category
- `latitude/longitude` - GPS coordinates
- `activity_level` - 0-20 scale (auto-updated)
- `last_activity` - Timestamp

### Messages Table
- `id` - UUID (primary key)
- `place_id` - Foreign key to places
- `username` - Sender name
- `content` - Message text
- `created_at` - Timestamp

## 🚢 Deployment

### Deploy Frontend (Vercel)

```bash
npm install -g vercel
vercel
```

### Backend
Already deployed on Supabase! Just update your `.env` with production URL.

## 📱 Converting to Mobile App

### Option 1: React Native (70% code reuse)

The architecture is designed for React Native migration:

1. **Shared Logic**: All Supabase queries, state management, and business logic work identically
2. **Map Component**: Replace Leaflet with `react-native-maps`
3. **UI Components**: Replace CSS with React Native StyleSheet or Tailwind RN

```bash
npx react-native init PlaceConnectMobile
# Copy src/lib/* (100% reusable)
# Adapt components to React Native
```

### Option 2: Flutter (requires rewrite)

Convert data models to Dart and use:
- `supabase_flutter` package
- `google_maps_flutter` for maps
- Same database schema (no changes needed)

### Option 3: PWA (Instant mobile install)

Add to `index.html`:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#3b82f6">
```

Create `public/manifest.json`:

```json
{
  "name": "PlaceConnect",
  "short_name": "PlaceConnect",
  "start_url": "/",
  "display": "standalone",
  "icons": [...]
}
```

Users can "Add to Home Screen" on mobile browsers.

## 🔐 Security Notes

Current MVP uses:
- **Public access** to all chats (like Clubhouse rooms)
- **Row Level Security** enabled but permissive
- **No user authentication** (by design for MVP)

For production:
1. Enable Supabase Auth
2. Add user ownership to messages
3. Add moderation tools
4. Implement rate limiting

## 🎯 Use Cases

- **Universities**: Study groups, class discussions
- **Coffee shops**: Find study buddies, coworking meetups
- **Sports courts**: "Anyone playing now?"
- **Coworking spaces**: Networking, collaboration
- **Libraries**: Silent accountability partners
- **Parks**: Meetups, events, activities

## 🐛 Troubleshooting

### Map not loading?
- Check internet connection
- Verify Leaflet CSS is imported
- Clear browser cache

### Messages not real-time?
- Check Supabase Replication is enabled
- Verify Realtime is configured in `supabase.js`
- Check browser console for WebSocket errors

### Can't connect to database?
- Verify `.env` credentials are correct
- Ensure RLS policies are set up
- Check Supabase project status

## 📝 License

MIT - Build whatever you want with this!

## 🤝 Contributing

This is a starter template - fork it and make it yours! Ideas:
- Add more place types
- Implement user profiles
- Add photo/gif support
- Build recommendation engine
- Create admin dashboard

## 📧 Questions?

Open an issue or customize this for your needs!

---

Built with ❤️ for local communities
