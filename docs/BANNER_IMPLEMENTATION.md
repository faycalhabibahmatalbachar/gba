# Plan d'Implementation des Bannieres - App Mobile GBA

## 1. Architecture

### Base de donnees (Supabase)
La table `banners` existe deja. Structure attendue :
```sql
banners (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  link_type TEXT, -- 'product', 'category', 'url', 'promo'
  link_value TEXT, -- product_id, category_id, URL, ou code promo
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### Flux de donnees
```
Admin Web (CRUD bannieres) 
  -> Supabase (table banners)
    -> App Mobile (affichage en haut de l'ecran d'accueil)
```

## 2. Implementation Mobile (Flutter)

### 2.1 Widget BannerCarousel (en haut du HomeScreen)
- **Emplacement** : `lib/widgets/banner_carousel.dart`
- **Position** : Tout en haut de `home_screen_premium.dart`, avant les categories
- **Type** : `PageView` avec auto-scroll (3-5 secondes)
- **Design** :
  - Hauteur : 180px (mobile), coins arrondis 16px
  - Indicateurs de page en bas (dots)
  - Gradient overlay en bas pour la lisibilite du texte
  - Titre + description en overlay
  - Tap -> navigation selon `link_type`

### 2.2 Service BannerService
- **Emplacement** : `lib/services/banner_service.dart`
- **Fonctions** :
  - `fetchActiveBanners()` : recupere les bannieres actives triees par priorite
  - Filtre par `start_date` <= now <= `end_date`
  - Cache local avec `shared_preferences` (TTL 30 min)

### 2.3 Provider (Riverpod)
```dart
final bannersProvider = FutureProvider<List<Banner>>((ref) async {
  return BannerService().fetchActiveBanners();
});
```

### 2.4 Navigation au tap
```dart
onTap: () {
  switch (banner.linkType) {
    case 'product':
      Navigator.pushNamed(context, '/product', arguments: banner.linkValue);
      break;
    case 'category':
      Navigator.pushNamed(context, '/category', arguments: banner.linkValue);
      break;
    case 'url':
      launchUrl(Uri.parse(banner.linkValue));
      break;
    case 'promo':
      // Appliquer le code promo et naviguer vers le panier
      break;
  }
}
```

## 3. Implementation Admin Web (React)

### Page Bannieres (`/banners`)
La page existe deja. Verifier qu'elle inclut :
- [x] Liste des bannieres avec apercu image
- [x] CRUD complet (creer, modifier, supprimer)
- [ ] Apercu mobile (mockup telephone)
- [ ] Tri par drag-and-drop pour la priorite
- [ ] Indicateur de statut (active/inactive/programmee)

## 4. Push Notification
Quand une banniere est creee avec `is_active = true` :
- Declencher l'event `banner_created` vers l'Edge Function
- Envoyer une notification push a tous les clients
- Titre : "Nouvelle promotion !"
- Corps : titre de la banniere

## 5. Etapes d'implementation

| # | Tache | Fichier | Priorite |
|---|-------|---------|----------|
| 1 | Creer le modele Banner | `lib/models/banner.dart` | Haute |
| 2 | Creer BannerService | `lib/services/banner_service.dart` | Haute |
| 3 | Creer BannerCarousel widget | `lib/widgets/banner_carousel.dart` | Haute |
| 4 | Integrer dans HomeScreen | `lib/screens/home_screen_premium.dart` | Haute |
| 5 | Ajouter le provider Riverpod | `lib/providers/banner_provider.dart` | Haute |
| 6 | Trigger push notification | `supabase/functions/send-push-notification` | Moyenne |
| 7 | Ameliorer page admin bannieres | `admin-react/src/pages/Banners.jsx` | Moyenne |

## 6. Design Reference

```
+------------------------------------------+
|  [========= Banner Carousel =========]   |  <- 180px, auto-scroll
|  |  IMAGE                            |   |
|  |  ____________________________     |   |
|  |  | Titre de la banniere     |     |   |
|  |  | Description courte       |     |   |
|  |  |__________________________|     |   |
|  |         o  .  .  .               |   |  <- dots indicateurs
|  +------------------------------------+   |
|                                          |
|  Categories          Voir tout >         |
|  [Cat1] [Cat2] [Cat3] [Cat4]           |
|                                          |
|  Recommandes         Voir tout >         |
|  [Prod1] [Prod2] [Prod3]               |
+------------------------------------------+
```
