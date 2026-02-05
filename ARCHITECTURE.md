# 🏗️ Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER DEVICE                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           React Web App (Vite + React)              │  │
│  │                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │  │
│  │  │   MapView    │  │  ChatPanel   │  │ Username│  │  │
│  │  │  (Leaflet)   │  │  (Messages)  │  │  Modal  │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────┘  │  │
│  │                                                     │  │
│  │         ┌──────────────────────────┐               │  │
│  │         │  Supabase Client (JS)    │               │  │
│  │         │  - Real-time subscriptions│               │  │
│  │         │  - Database queries       │               │  │
│  │         └──────────────────────────┘               │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE BACKEND                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             PostgreSQL Database                      │  │
│  │                                                      │  │
│  │  ┌─────────────┐        ┌──────────────┐           │  │
│  │  │   Places    │◄───────│   Messages   │           │  │
│  │  │   Table     │        │    Table     │           │  │
│  │  └─────────────┘        └──────────────┘           │  │
│  │      │                         │                    │  │
│  │      │ RLS Policies            │ RLS Policies       │  │
│  │      │ Indexes                 │ Indexes            │  │
│  │      │ Triggers                │ Triggers           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Realtime Server                           │  │
│  │         (WebSocket connections)                      │  │
│  │                                                      │  │
│  │  - Broadcasts new messages                          │  │
│  │  - Presence tracking                                │  │
│  │  - Change data capture                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            PostgREST API                             │  │
│  │         (Auto-generated REST API)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Opens App

```
User → Opens Browser
    ↓
React App Loads
    ↓
Check localStorage for username
    ↓
If no username → Show UsernameModal
    ↓
Load places from Supabase
    ↓
Render map with markers
```

### 2. User Clicks a Place

```
User clicks marker
    ↓
App calls onPlaceSelect(place)
    ↓
ChatPanel component mounts
    ↓
1. Load last 50 messages
2. Subscribe to realtime changes
3. Join presence channel
    ↓
Display chat interface
```

### 3. User Sends Message

```
User types message → Clicks Send
    ↓
ChatPanel calls supabase.from('messages').insert(...)
    ↓
PostgreSQL:
  1. Insert message row
  2. Trigger: update_place_activity()
  3. Broadcast change via Realtime
    ↓
All connected clients receive update
    ↓
Messages list updates automatically
Activity indicator changes color
```

## Component Hierarchy

```
App
├── UsernameModal (conditional)
├── Header
│   ├── Logo
│   └── UserInfo
│       └── Change Username Button
└── Content
    ├── MapView
    │   ├── Leaflet Map
    │   ├── Custom Markers
    │   │   ├── Pulse Animation
    │   │   ├── Icon
    │   │   └── Label
    │   └── Legend
    └── ChatPanel (conditional)
        ├── Header
        │   ├── Place Info
        │   ├── Online Count
        │   └── Close Button
        ├── Messages Container
        │   └── Message Items
        │       ├── Username
        │       ├── Timestamp
        │       └── Content
        └── Input Area
            ├── Text Input
            └── Send Button
```

## State Management

### App-Level State
```javascript
{
  username: string,              // From localStorage
  showUsernameModal: boolean,    // UI state
  places: Place[],               // From Supabase
  selectedPlace: Place | null    // Currently viewing
}
```

### ChatPanel State
```javascript
{
  messages: Message[],           // Current room messages
  newMessage: string,            // Input field
  onlineUsers: number            // From presence
}
```

### MapView State
```javascript
{
  mapInstance: L.Map,            // Leaflet map object
  markers: Map<id, L.Marker>     // Place markers
}
```

## Database Schema

### Places Table
```sql
places
├── id (UUID, PK)
├── name (VARCHAR)
├── type (VARCHAR)
│   ├── school
│   ├── university
│   ├── cafe
│   ├── basketball_court
│   ├── library
│   ├── park
│   ├── gym
│   └── coworking
├── latitude (DECIMAL)
├── longitude (DECIMAL)
├── address (TEXT)
├── description (TEXT)
├── activity_level (INTEGER 0-20)
│   └── Auto-updated by trigger
├── last_activity (TIMESTAMP)
└── created_at (TIMESTAMP)

Indexes:
- idx_places_activity (activity_level DESC)
- idx_places_location (latitude, longitude)
```

### Messages Table
```sql
messages
├── id (UUID, PK)
├── place_id (UUID, FK → places.id)
├── username (VARCHAR)
├── content (TEXT)
└── created_at (TIMESTAMP)

Indexes:
- idx_messages_place_id (place_id)
- idx_messages_created_at (created_at DESC)

Cascade:
- ON DELETE CASCADE (if place deleted)
```

## Real-Time Flow

### WebSocket Connection

```
1. Component mounts
   ↓
2. Create channel: supabase.channel('place-123')
   ↓
3. Subscribe to postgres_changes for messages
   ↓
4. Subscribe to presence for online users
   ↓
5. Call channel.subscribe()
   ↓
6. WebSocket connection established
   ↓
7. Listen for broadcasts
   ↓
8. On unmount: removeChannel()
```

### Activity Level Update

```
New message inserted
   ↓
Trigger: update_place_activity()
   ↓
Count messages in last 1 hour
   ↓
Update places.activity_level
   ↓
Broadcast to all map viewers
   ↓
Marker color changes automatically
```

## Security Architecture

### Row Level Security (RLS)

```sql
-- Everyone can read places
CREATE POLICY "Public read places" 
  ON places FOR SELECT USING (true);

-- Everyone can read messages
CREATE POLICY "Public read messages"
  ON messages FOR SELECT USING (true);

-- Everyone can insert messages
CREATE POLICY "Public insert messages"
  ON messages FOR INSERT WITH CHECK (true);
```

### Future Auth Integration

```sql
-- Only authenticated users can message
CREATE POLICY "Authenticated insert messages"
  ON messages FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only edit their own messages
CREATE POLICY "Users edit own messages"
  ON messages FOR UPDATE
  USING (auth.uid()::text = user_id);
```

## Performance Optimizations

### 1. Database Level
- Indexes on frequently queried columns
- Partial indexes for recent messages
- Auto-cleanup of old messages (7+ days)
- Connection pooling (Supabase handles)

### 2. Frontend Level
- Component lazy loading
- Virtual scrolling for long message lists
- Debounced map updates
- Memoized marker rendering

### 3. Network Level
- Vite code splitting
- Asset optimization
- CDN for static files (Vercel Edge)
- WebSocket connection reuse

## Scalability Path

### Phase 1: MVP (Current)
- **Users**: 0-1,000
- **Infrastructure**: Free tiers
- **Database**: 500MB
- **Cost**: $0

### Phase 2: Growth
- **Users**: 1,000-10,000
- **Infrastructure**: Vercel Pro + Supabase Pro
- **Database**: 8GB
- **Add**: 
  - Redis caching
  - Rate limiting
  - CDN optimization
- **Cost**: ~$50-100/month

### Phase 3: Scale
- **Users**: 10,000-100,000
- **Infrastructure**: Custom plan
- **Database**: Dedicated instance
- **Add**:
  - Read replicas
  - Message queue
  - Separate real-time service
  - Load balancer
- **Cost**: ~$500-1,000/month

## Monitoring & Observability

### Key Metrics to Track

```javascript
// Database
- Query latency
- Connection pool usage
- Storage size
- Active connections

// Application
- Page load time
- Time to interactive
- WebSocket connection success rate
- Message delivery latency

// Business
- Daily active users
- Messages per place
- Peak concurrent users
- Average session duration
```

### Alerts to Set Up

1. Database connection pool >80%
2. API response time >1s
3. WebSocket connection failures >5%
4. Error rate >1%

## Development Workflow

```
Local Development
├── 1. Edit code
├── 2. Hot reload (Vite)
├── 3. Test in browser
└── 4. Use local Supabase or staging

Staging
├── 1. Push to staging branch
├── 2. Auto-deploy to Vercel preview
├── 3. Test real-time features
└── 4. QA approval

Production
├── 1. Merge to main
├── 2. Auto-deploy to Vercel
├── 3. Monitor metrics
└── 4. Rollback if needed
```

## API Endpoints (Generated by PostgREST)

```
GET    /rest/v1/places                 # List all places
GET    /rest/v1/places?id=eq.UUID      # Get specific place
POST   /rest/v1/places                 # Create place (if policy allows)
PATCH  /rest/v1/places?id=eq.UUID      # Update place

GET    /rest/v1/messages?place_id=eq.UUID&order=created_at.desc&limit=50
POST   /rest/v1/messages               # Send message

WebSocket:
ws://[project].supabase.co/realtime/v1/websocket
```

## Future Architecture Enhancements

### 1. Microservices Split
```
Current: Monolith
Future:
├── API Service (REST)
├── Real-time Service (WebSocket)
├── Auth Service
├── Media Service (images/videos)
└── Analytics Service
```

### 2. Caching Layer
```
Redis Cache
├── Active places (TTL: 1 min)
├── Recent messages (TTL: 5 min)
├── User sessions (TTL: 24 hours)
└── Rate limit counters (TTL: 1 hour)
```

### 3. Message Queue
```
RabbitMQ / SQS
├── Push notifications
├── Email digests
├── Analytics events
└── Moderation queue
```

This architecture is designed to start simple and scale horizontally as needed!
