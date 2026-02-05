# 📱 Mobile App Migration Guide

This guide shows you how to convert PlaceConnect from a web app to a native mobile app.

## Option 1: React Native (Recommended - 70% Code Reuse)

### Why React Native?
- ✅ Reuse all Supabase logic (100%)
- ✅ Similar component structure
- ✅ Same programming language (JavaScript)
- ✅ Active community, great libraries
- ✅ Hot reloading for fast development

### Setup Steps

#### 1. Initialize React Native Project

```bash
npx react-native@latest init PlaceConnectMobile
cd PlaceConnectMobile
```

#### 2. Install Dependencies

```bash
# Core dependencies
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# Map
npm install react-native-maps

# Additional utilities
npm install react-native-url-polyfill
npm install @react-native-community/netinfo
```

#### 3. Code Migration Map

| Web Component | React Native Equivalent | Reusability |
|--------------|------------------------|-------------|
| `src/lib/supabase.js` | Copy directly | 100% |
| Supabase queries | Copy directly | 100% |
| State management | Copy directly | 100% |
| `MapView.jsx` | Use `react-native-maps` | 30% (logic reusable) |
| `ChatPanel.jsx` | Use `FlatList` + `TextInput` | 50% (logic reusable) |
| `UsernameModal.jsx` | Use `Modal` component | 60% |
| CSS files | Convert to `StyleSheet` | 0% (structure reusable) |

#### 4. Supabase Configuration (No Changes!)

```javascript
// lib/supabase.js - WORKS AS-IS!
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // Only change needed!
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

#### 5. Map Component Conversion

**Before (Web - Leaflet):**
```javascript
import L from 'leaflet';
const map = L.map(mapRef.current).setView([41.7151, 44.8271], 13);
```

**After (React Native - react-native-maps):**
```javascript
import MapView, { Marker } from 'react-native-maps';

<MapView
  style={styles.map}
  initialRegion={{
    latitude: 41.7151,
    longitude: 44.8271,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>
  {places.map(place => (
    <Marker
      key={place.id}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      title={place.name}
      onPress={() => onPlaceSelect(place)}
    />
  ))}
</MapView>
```

#### 6. Chat Component Conversion

**Before (Web):**
```javascript
<div className="messages-container">
  {messages.map(msg => (
    <div className="message">{msg.content}</div>
  ))}
</div>
```

**After (React Native):**
```javascript
import { FlatList, View, Text } from 'react-native';

<FlatList
  data={messages}
  renderItem={({ item }) => (
    <View style={styles.message}>
      <Text style={styles.username}>{item.username}</Text>
      <Text>{item.content}</Text>
    </View>
  )}
  keyExtractor={item => item.id}
/>
```

#### 7. Platform-Specific Code

```javascript
import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    padding: Platform.select({
      ios: 20,
      android: 16,
    }),
  },
});
```

### What Stays Exactly the Same:

1. **All Supabase queries** ✅
```javascript
// This works identically in React Native!
const { data } = await supabase
  .from('places')
  .select('*');
```

2. **Real-time subscriptions** ✅
```javascript
// This also works identically!
const channel = supabase
  .channel('places-activity')
  .on('postgres_changes', {...})
  .subscribe();
```

3. **Business logic** ✅
4. **State management** ✅
5. **Database schema** ✅

### What Changes:

1. **UI Components**: `<div>` → `<View>`, `<p>` → `<Text>`
2. **Styling**: CSS files → `StyleSheet.create()`
3. **Map library**: Leaflet → react-native-maps
4. **Input**: `<input>` → `<TextInput>`
5. **Navigation**: Manual → React Navigation

### Full Example: Chat Panel in React Native

```javascript
// components/ChatPanel.jsx (React Native version)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../lib/supabase';

const ChatPanel = ({ place, username, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // ALL THIS LOGIC IS IDENTICAL TO WEB VERSION!
  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`place-${place.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `place_id=eq.${place.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [place.id]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('place_id', place.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await supabase.from('messages').insert({
      place_id: place.id,
      username,
      content: newMessage.trim(),
    });
    setNewMessage('');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{place.name}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <View style={[
            styles.message,
            item.username === username && styles.ownMessage
          ]}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.content}>{item.content}</Text>
          </View>
        )}
        keyExtractor={item => item.id}
      />

      <View style={styles.inputContainer}>
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          style={styles.input}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  message: {
    padding: 12,
    margin: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    maxWidth: '80%',
  },
  ownMessage: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ChatPanel;
```

---

## Option 2: Flutter (Full Rewrite)

### Why Flutter?
- ✅ Beautiful native performance
- ✅ Single codebase for iOS + Android
- ✅ Rich widget library
- ❌ Requires learning Dart
- ❌ 0% code reuse from React

### Setup Steps

```bash
flutter create placeconnect_mobile
cd placeconnect_mobile
```

### Dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.0.0
  google_maps_flutter: ^2.5.0
  provider: ^6.1.1
```

### Supabase Configuration

```dart
// lib/supabase.dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> initSupabase() async {
  await Supabase.initialize(
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  );
}

final supabase = Supabase.instance.client;
```

### Example: Messages in Flutter

```dart
// lib/services/message_service.dart
class MessageService {
  Stream<List<Message>> getMessages(String placeId) {
    return supabase
      .from('messages')
      .stream(primaryKey: ['id'])
      .eq('place_id', placeId)
      .order('created_at')
      .map((data) => data.map((item) => Message.fromJson(item)).toList());
  }

  Future<void> sendMessage(String placeId, String username, String content) {
    return supabase.from('messages').insert({
      'place_id': placeId,
      'username': username,
      'content': content,
    });
  }
}
```

---

## Option 3: PWA (Progressive Web App)

### Why PWA?
- ✅ 0% code changes needed!
- ✅ Installable on mobile
- ✅ Works offline (with service worker)
- ✅ Push notifications possible
- ❌ Slightly less performant than native
- ❌ Limited access to device features

### Setup (Add to existing web app)

#### 1. Create manifest.json

```json
{
  "name": "PlaceConnect",
  "short_name": "PlaceConnect",
  "description": "Chat with your neighborhood",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 2. Update index.html

```html
<head>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#3b82f6">
  <link rel="apple-touch-icon" href="/icon-192.png">
</head>
```

#### 3. Add Service Worker

```javascript
// public/service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/static/css/main.css',
        '/static/js/main.js',
      ]);
    })
  );
});
```

Users can now install your app from mobile browsers!

---

## Recommendation

**Start with**: React Native (Option 1)
- Best code reuse (70%)
- Fastest to market
- Easy to maintain
- Same database works perfectly

**Consider Flutter if**: You want to learn a new framework and need ultra-smooth animations

**Consider PWA if**: You want mobile support NOW with zero extra work

---

## Migration Timeline Estimate

| Approach | Setup | Development | Testing | Total |
|----------|-------|-------------|---------|-------|
| React Native | 1 day | 5-7 days | 2-3 days | ~10 days |
| Flutter | 1 day | 10-14 days | 3-4 days | ~18 days |
| PWA | 2 hours | 0 days | 1 day | ~1 day |

All assuming one developer working part-time.
