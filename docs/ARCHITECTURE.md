# Architecture Système GBA - E-commerce Platform

## 🏗️ Vue d'ensemble

GBA est une plateforme e-commerce complète avec 3 applications principales :
- **App Mobile Client** (Flutter) - Shopping et commandes
- **App Web Admin** (React/Next.js) - Gestion back-office
- **App Mobile Driver** (Flutter) - Livraisons

---

## 📱 App Mobile Client - Architecture

### Navigation System
```
MainNavigationScreen (PageView)
├── HomeScreenPremium (index: 0)
├── CategoriesScreenPremium (index: 1)
├── CartScreenPremium (index: 2)
├── FavoritesScreenPremium (index: 3)
└── ProfileScreenUltra (index: 4)
```

**Features:**
- ✅ Swipe horizontal entre pages
- ✅ Animations fluides (300ms fade)
- ✅ Bottom navigation bar synchronisé
- ✅ Back button intelligent (home → double-tap exit)
- ✅ KeepAlive pour cache pages

### State Management
```
Provider (classic_provider)
├── AuthProvider - Authentification
├── CartProvider - Panier
├── ProductProvider - Produits
├── CategoriesProvider - Catégories
├── FavoritesProvider - Favoris
├── BannerProvider - Bannières
└── MessagingService - Chat

Riverpod (flutter_riverpod)
└── Utilisé pour certains widgets isolés
```

### Caching Strategy (3-Tier)

**Tier 1: Memory Cache**
- In-memory Map
- Ultra-rapide (< 1ms)
- LRU eviction (max 100 entries)
- Volatile (perdu au restart)

**Tier 2: Disk Cache**
- SharedPreferences
- Persistant
- TTL configurables
- Fallback si memory miss

**Tier 3: Network**
- Supabase API
- Source de vérité
- Realtime subscriptions
- Optimistic updates

**Cache TTL:**
```dart
Products: 5 minutes
Categories: 10 minutes
Cart: 30 seconds
Favorites: 3 minutes
Banners: 15 minutes
Recommendations: 5 minutes
```

### GPS Location Tracking

**Architecture:**
```
BackgroundLocationTrackingService
├── Geolocator (high accuracy)
├── Flutter Background Service
├── Position Stream (10s interval)
├── Batch Upload (30s or 5 positions)
└── Realtime Update (current position)
```

**Features:**
- ✅ Auto-start au lancement app
- ✅ Background tracking (app fermée)
- ✅ High precision (bestForNavigation)
- ✅ Battery-aware (distance filter 10m)
- ✅ Batch upload pour économie réseau
- ✅ Realtime streaming pour driver/admin

**Tables Supabase:**
- `user_locations` - Historique (30 jours)
- `user_current_location` - Position actuelle

---

## 🌐 App Web Admin - Architecture

### Stack Technique
```
React 18
├── Next.js 14 (SSR/SSG)
├── Material-UI (Components)
├── Redux Toolkit (State)
├── React Hook Form (Forms)
└── Recharts (Analytics)
```

### Pages Principales
```
/dashboard - Analytics & KPIs
/products - Gestion produits (CRUD)
/orders - Gestion commandes
/deliveries - Tracking GPS livraisons
/users - Gestion utilisateurs
/messages - Chat WhatsApp-style
/settings - Configuration
```

### Realtime Features
- ✅ Nouvelles commandes (toast notification)
- ✅ Messages chat (auto-scroll)
- ✅ Positions GPS drivers (carte live)
- ✅ Statuts livraisons (badges)

---

## 🚗 App Mobile Driver - Architecture

### Features Principales
```
DriverHomeScreen
├── Liste commandes assignées
├── Toggle disponibilité
├── Statistiques livreur
└── Navigation rapide

DriverMapScreen
├── Carte interactive
├── Marqueurs animés
├── Trail de mouvement
└── Itinéraire optimisé

DriverChatScreen
├── Chat avec client
├── Upload photos
└── Appel téléphone direct
```

### Location Tracking
- ✅ Position temps réel (5s interval)
- ✅ Background service
- ✅ Streaming vers Supabase
- ✅ Visible par admin/client

---

## 🔧 Backend - Architecture

### Supabase (BaaS)

**Database Schema:**
```
auth.users (Supabase Auth)
├── profiles (1:1)
├── cart_items (1:N)
├── favorites (1:N)
├── orders (1:N)
├── reviews (1:N)
├── user_locations (1:N)
└── chat_conversations (1:N)

products
├── categories (N:1)
├── reviews (1:N)
└── order_items (1:N)

orders
├── order_items (1:N)
├── driver (N:1 profiles)
└── customer (N:1 profiles)

chat_conversations
└── chat_messages (1:N)
```

**Row Level Security (RLS):**
- ✅ Users can only access their own data
- ✅ Admins can access all data
- ✅ Drivers can access assigned orders
- ✅ Public read for products/categories

**Realtime Channels:**
```
chat_messages - Messagerie
user_current_location - GPS tracking
orders - Statuts commandes
cart_items - Panier sync
favorites - Favoris sync
```

### FastAPI (Recommendations)

**Endpoint:**
```
GET /v1/recommendations?user_id={id}&limit={n}
```

**Algorithm:**
- Collaborative filtering
- User activity tracking
- Product similarity
- Popularity boost

**Deployment:**
- Vercel Serverless Functions
- Auto-scaling
- Edge network

---

## 🔐 Sécurité

### Authentication
- ✅ Supabase Auth (JWT)
- ✅ Email verification (OTP)
- ✅ Password reset
- ✅ Session management
- ✅ Role-based access (admin/driver/customer)

### Data Protection
- ✅ RLS policies (Supabase)
- ✅ HTTPS only
- ✅ API key rotation
- ✅ Secrets in environment variables
- ✅ Firebase credentials gitignored

### Privacy
- ✅ GDPR compliant (prévu)
- ✅ Data retention policies (30 days GPS)
- ✅ User data export (prévu)
- ✅ Account deletion cascade

---

## 📊 Performance

### Optimizations

**Mobile App:**
- ✅ 3-tier caching (Memory + Disk + Network)
- ✅ Lazy loading images
- ✅ Pagination serveur (24/page)
- ✅ Debounce search (350ms)
- ✅ Optimistic updates
- ✅ Image compression

**Backend:**
- ✅ Database indexes
- ✅ Connection pooling
- ✅ Query optimization
- ✅ CDN for static assets (prévu)
- ✅ Redis cache (prévu)

### Metrics
```
App Launch: < 2s
API Response: < 200ms
Cache Hit Rate: > 80%
Crash Rate: < 0.5%
```

---

## 🚀 Deployment

### Production URLs
```
Mobile App: Play Store / App Store (prévu)
Admin Web: https://globalbusinessamdaradir.vercel.app
Backend API: https://gbabackend.vercel.app
Supabase: uvlrgwdbjegoavjfdrzb.supabase.co
```

### CI/CD Pipeline (Prévu)
```
GitHub Actions
├── Lint & Format
├── Unit Tests
├── Integration Tests
├── Build APK/IPA
├── Deploy Vercel
└── Deploy Supabase Migrations
```

---

## 📈 Scalability

### Current Capacity
- **Users:** 10K+ concurrent
- **Orders:** 1K+ per day
- **Database:** 100GB storage
- **API:** 1M requests/month

### Scaling Strategy
1. **Horizontal:** Add Supabase read replicas
2. **Vertical:** Upgrade database tier
3. **Caching:** Redis for hot data
4. **CDN:** Cloudflare for images
5. **Microservices:** Split monolith (prévu)

---

## 🔄 Data Flow

### Order Placement
```
1. Client adds to cart (CartProvider)
2. Optimistic update + DB insert
3. Navigate to checkout
4. Collect shipping info + GPS
5. Create order (Supabase)
6. Initiate payment (Flutterwave)
7. Webhook confirms payment
8. Trigger notification (FCM)
9. Admin sees new order (Realtime)
10. Assign driver
11. Driver receives notification
12. GPS tracking starts
13. Delivery completed
14. Review prompt
```

### Real-time Chat
```
1. User opens chat (MessagingService)
2. Load conversations (cache-first)
3. Subscribe to realtime channel
4. Send message (optimistic update)
5. Insert to DB (chat_messages)
6. Broadcast to channel
7. Admin receives (realtime)
8. Admin replies
9. User receives (FCM + realtime)
10. Mark as read
11. Update unread count
```

---

## 🛠️ Development Setup

### Prerequisites
```bash
Flutter SDK: >= 3.0.0
Node.js: >= 18.0.0
Supabase CLI: >= 1.0.0
Git: >= 2.30.0
```

### Environment Variables
```env
# Supabase
SUPABASE_URL=https://uvlrgwdbjegoavjfdrzb.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-...
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...

# Firebase
FIREBASE_PROJECT_ID=globalbusinessamdaradir-fba45

# Backend
BACKEND_URL=https://gbabackend.vercel.app
```

### Local Development
```bash
# Mobile app
cd gba/
flutter pub get
flutter run

# Admin web
cd admin-react/
npm install
npm run dev

# Backend API
cd backend/
pip install -r requirements.txt
uvicorn app:app --reload
```

---

## 📚 Documentation

- **API Docs:** `/docs/API.md`
- **Database Schema:** `/docs/DATABASE.md`
- **Setup Guide:** `/SUPABASE_SETUP.md`
- **Deployment:** `/VERCEL_GUIDE.md`
- **Improvements:** `/docs/PROJECT_IMPROVEMENTS.md`

---

**Dernière mise à jour:** 7 Mars 2026  
**Version:** 2.0.0  
**Auteur:** GBA Development Team
