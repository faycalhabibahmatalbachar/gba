# Plan DB/RLS/RPC – App Livreur Opérationnelle (flutter_map)

## 1. Vue d’ensemble

L’objectif est de rendre l’application mobile du livreur **opérationnelle** en s’appuyant sur les tables existantes (`drivers`, `delivery_assignments`, `driver_locations`, `orders`, `order_items`) et en ajoutant les éléments manquants pour une expérience complète : **assignations, statuts, tracking GPS, preuve de livraison (POD), offline, sécurité**, et **remplacement de Google Maps par flutter_map (OSM + routing)**.

---

## 2. Tables existantes (déjà créées)

| Table | Rôle | RLS actuel |
|-------|------|------------|
| `drivers` | Profils des livreurs (user_id, name, phone, is_active) | Admin all + select self |
| `delivery_assignments` | Liaison commande ↔ driver (order_id, driver_id, status, assigned_at) | Admin all + select owner |
| `driver_locations` | GPS temps réel (driver_id, order_id, lat, lng, accuracy, captured_at) | Admin all + driver insert/select |
| `orders` | Commandes (avec `delivery_lat/lng/accuracy/captured_at` déjà présents) | RLS existant |
| `order_items` | Détails commande | RLS existant |

---

## 3. Ajout manquant : Preuve de Livraison (POD)

### 3.1 Table `delivery_proofs`

```sql
create table if not exists public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  photo_url text,
  signature_url text,
  notes text,
  delivered_at timestamptz not null default now(),
  delivered_lat double precision,
  delivered_lng double precision,
  delivered_accuracy double precision,
  created_at timestamptz not null default now()
);
```

### 3.2 RLS – `delivery_proofs`

```sql
alter table public.delivery_proofs enable row level security;

-- Admins tout
create policy "delivery_proofs_admin_all" on public.delivery_proofs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Livreur insère/select ses propres preuves
create policy "delivery_proofs_driver_self" on public.delivery_proofs
  for insert to authenticated with check (
    exists(select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid())
  );

create policy "delivery_proofs_driver_select" on public.delivery_proofs
  for select to authenticated using (
    exists(select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid())
  );
```

---

## 4. Workflow des statuts de livraison (delivery_assignments.status)

| Statut | Description | Action driver |
|--------|-------------|---------------|
| `assigned` | Commande assignée au driver | Accepter/Refuser |
| `accepted` | Driver accepte la livraison | Démarrer navigation |
| `en_route` | En route vers client | Mise à jour GPS continue |
| `arrived` | Arrivé sur place | Prendre photo/signature |
| `delivered` | Livré avec POD | Finir la mission |
| `failed` | Échec (client absent, etc.) | Motif + relance ou retour |

---

## 5. RPC – Fonctions utilitaires pour le driver

### 5.1 `driver_get_my_assignments`

Retourne les commandes assignées au driver authentifié.

```sql
create or replace function public.driver_get_my_assignments()
returns table (
  assignment_id uuid,
  order_id uuid,
  order_number text,
  status text,
  assigned_at timestamptz,
  customer_name text,
  customer_phone text,
  shipping_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  total_amount numeric,
  items jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    da.id as assignment_id,
    o.id as order_id,
    o.order_number,
    da.status,
    da.assigned_at,
    o.customer_name,
    o.customer_phone,
    o.shipping_address,
    o.delivery_lat,
    o.delivery_lng,
    o.total_amount,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price
        ) order by oi.created_at
      ), '[]'::jsonb
    ) as items
  from delivery_assignments da
  join orders o on o.id = da.order_id
  join drivers d on d.id = da.driver_id
  left join order_items oi on oi.order_id = o.id
  where d.user_id = auth.uid()
    and d.is_active = true
  group by da.id, o.id, d.id
  order by da.assigned_at desc;
$$;
```

### 5.2 `driver_update_assignment_status`

Met à jour le statut d’une assignation (avec validation d’appartenance).

```sql
create or replace function public.driver_update_assignment_status(
  p_assignment_id uuid,
  p_new_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
begin
  select d.id into v_driver_id
  from drivers d
  where d.user_id = auth.uid() and d.is_active = true;

  if not found then
    raise exception 'Driver not found or inactive';
  end if;

  update delivery_assignments
  set status = p_new_status,
      updated_at = now()
  where id = p_assignment_id
    and driver_id = v_driver_id;

  return found;
end;
$$;
```

### 5.3 `driver_save_location_batch`

Batch de positions (offline support).

```sql
create or replace function public.driver_save_location_batch(
  p_locations jsonb  -- array of {lat, lng, accuracy, captured_at, order_id?}
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  rec jsonb;
begin
  select d.id into v_driver_id
  from drivers d
  where d.user_id = auth.uid() and d.is_active = true;

  if not found then
    raise exception 'Driver not found or inactive';
  end if;

  foreach rec in select * from jsonb_array_elements(p_locations)
  loop
    insert into driver_locations (
      driver_id,
      order_id,
      lat,
      lng,
      accuracy,
      captured_at
    ) values (
      v_driver_id,
      rec->>'order_id',
      (rec->>'lat')::double precision,
      (rec->>'lng')::double precision,
      (rec->>'accuracy')::double precision,
      (rec->>'captured_at')::timestamptz
    );
  end loop;
end;
$$;
```

---

## 6. Intégration `flutter_map` (OSM + routing)

### 6.1 Remplacement de Google Maps

- **Carte** : `flutter_map` avec TileLayer OpenStreetMap.
- **Itinéraire** : Utiliser l’API publique **OSRM** (Open Source Routing Machine) ou **GraphHopper** pour calculer le trajet (pas de clé API requise pour usage modéré).
- **Marker** : Position driver + destination.

### 6.2 Exemple de code (Flutter)

```dart
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

FlutterMap(
  options: MapOptions(
    initialCenter: LatLng(driverLat, driverLng),
    initialZoom: 14,
  ),
  children: [
    TileLayer(
      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      userAgentPackageName: 'com.example.gba',
    ),
    MarkerLayer(
      markers: [
        Marker(
          point: LatLng(driverLat, driverLng),
          child: Icon(Icons.delivery_dining, color: Colors.blue),
        ),
        Marker(
          point: LatLng(deliveryLat, deliveryLng),
          child: Icon(Icons.location_on, color: Colors.red),
        ),
      ],
    ),
    PolylineLayer(
      polylines: [
        Polyline(
          points: routePoints, // from OSRM
          strokeWidth: 4,
          color: Colors.blue,
        ),
      ],
    ),
  ],
)
```

### 6.3 Appel OSRM (exemple)

```dart
final url = Uri.parse(
    'https://router.project-osrm.org/route/v1/driving/'
    '$driverLng,$driverLat;$deliveryLng,$deliveryLat'
    '?overview=full&geometries=geojson');
final resp = await http.get(url);
final data = jsonDecode(resp.body);
final coords = data['routes'][0]['geometry']['coordinates'];
final routePoints = coords
    .map<LatLng>((c) => LatLng(c[1] as double, c[0] as double))
    .toList();
```

> **Note** : OSRM est public et gratuit à usage modéré. Pour la production, envisager une instance auto-hébergée ou GraphHopper.

---

## 7. Offline support (local cache + sync)

- Utiliser **Drift (Moor)** ou **Hive** pour stocker localement les commandes et les positions.
- En cas de perte réseau, accumuler les positions et les envoyer via `driver_save_location_batch` dès la reconnexion.
- Les statuts critiques (`accepted`, `arrived`, `delivered`) doivent être synchronisés avec retry exponentiel.

---

## 8. Sécurité & RLS

- Toutes les fonctions RPC sont `security definer` et valident que `auth.uid()` correspond bien à un driver actif.
- Les seules insertions dans `driver_locations` et `delivery_proofs` sont autorisées pour le driver lui-même.
- Les admins ont un accès total pour supervision.

---

## 9. Résumé des actions à faire

1. **Créer la table `delivery_proofs`** avec RLS.
2. **Ajouter les RPC** (`driver_get_my_assignments`, `driver_update_assignment_status`, `driver_save_location_batch`).
3. **Adapter le workflow de statuts** dans `delivery_assignments.status` (valeurs ci-dessus).
4. **Intégrer `flutter_map` + OSRM** dans l’app Flutter (remplacer Google Maps).
5. **Mettre en place le cache local** pour le support offline.
6. **Tester les RLS** avec un compte driver et un compte admin.

---

## 10. Bonus : Notifications push (FCM)

- Utiliser les **webhooks Supabase** sur `delivery_assignments` (INSERT/UPDATE) pour déclencher une Edge Function qui envoie une notification FCM au driver.
- Stocker les tokens FCM dans `profiles` ou une table `fcm_tokens` par driver.

---

## 11. Exécution du seed produits (1000+/catégorie)

Le seed a été créé dans `db/seeds/03_seed_products_1000_per_category.sql`.

Pour l’exécuter :

```bash
# Via Supabase CLI
supabase db reset --db-url postgresql://...  # reset + seed automatique
# Ou manuellement
psql $SUPABASE_DB_URL -f db/seeds/03_seed_products_1000_per_category.sql
```

Le seed est **idempotent** : il peut être relancé sans créer de doublons (grâce à `on conflict (sku) do nothing` et `on conflict (slug) do nothing`).

---

## 12. Checklist finale

- [ ] Table `delivery_proofs` + RLS
- [ ] RPC `driver_get_my_assignments`
- [ ] RPC `driver_update_assignment_status`
- [ ] RPC `driver_save_location_batch`
- [ ] Workflow statuts implémenté dans l’app
- [ ] flutter_map + OSRM intégré
- [ ] Cache local + sync batch
- [ ] Tests RLS (driver vs admin)
- [ ] Seed produits exécuté et vérifié

---

**Fin du plan.**
