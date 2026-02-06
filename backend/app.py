import math
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client


def _load_dotenv_file(file_path: str) -> None:
  try:
    with open(file_path, 'r', encoding='utf-8') as f:
      for line in f:
        raw = line.strip()
        raw = raw.lstrip('\ufeff')
        if not raw or raw.startswith('#'):
          continue
        if raw.startswith('export '):
          raw = raw[len('export '):].strip()
        if '=' not in raw:
          continue
        key, value = raw.split('=', 1)
        key = key.strip()
        key = key.lstrip('\ufeff')
        value = value.strip()
        if not key:
          continue
        if (
          (value.startswith('"') and value.endswith('"'))
          or (value.startswith("'") and value.endswith("'"))
        ):
          value = value[1:-1]
        if not os.environ.get(key, '').strip():
          os.environ[key] = value
  except FileNotFoundError:
    return
  except Exception:
    return


def _bootstrap_env() -> None:
  base_dir = os.path.dirname(os.path.abspath(__file__))
  candidates = [
    os.path.join(base_dir, '.env'),
    os.path.join(os.path.dirname(base_dir), '.env'),
  ]
  for p in candidates:
    _load_dotenv_file(p)


_bootstrap_env()


def _env(name: str) -> str:
  return os.getenv(name, '').strip()


SUPABASE_URL = _env('SUPABASE_URL')
SUPABASE_ANON_KEY = _env('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE_KEY = _env('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_API_KEY = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY


supabase: Optional[Client] = None
if SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY):
  supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)


class SupabaseUser(BaseModel):
  id: str
  email: Optional[str] = None


app = FastAPI()

origins_raw = _env('CORS_ALLOW_ORIGINS')
if origins_raw:
  origins = [o.strip() for o in origins_raw.split(',') if o.strip()]
else:
  origins = [
    "http://localhost:4074",
    "https://gba-vc4s.vercel.app",
    "https://gba-vc4s-jb288157k-gbas-projects-38754d42.vercel.app",
  ]

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=['*'],
  allow_headers=['*'],
)


async def _fetch_supabase_user(token: str) -> Dict[str, Any]:
  if not SUPABASE_URL or not SUPABASE_API_KEY:
    raise HTTPException(
      status_code=500,
      detail='Supabase auth not configured (set SUPABASE_URL and SUPABASE_ANON_KEY)',
    )

  url = f"{SUPABASE_URL}/auth/v1/user"
  async with httpx.AsyncClient(timeout=10.0) as client:
    res = await client.get(
      url,
      headers={
        'Authorization': f'Bearer {token}',
        'apikey': SUPABASE_API_KEY,
      },
    )

  if res.status_code != 200:
    raise HTTPException(status_code=401, detail='Invalid token')

  data = res.json()
  if not isinstance(data, dict) or not data.get('id'):
    raise HTTPException(status_code=401, detail='Invalid token')

  return data


async def get_current_user(authorization: str = Header(default='')) -> SupabaseUser:
  if not authorization.lower().startswith('bearer '):
    raise HTTPException(status_code=401, detail='Missing bearer token')

  token = authorization.split(' ', 1)[1].strip()
  if not token:
    raise HTTPException(status_code=401, detail='Missing bearer token')

  data = await _fetch_supabase_user(token)
  return SupabaseUser(id=str(data.get('id')), email=data.get('email'))


async def get_current_token(authorization: str = Header(default='')) -> str:
  if not authorization.lower().startswith('bearer '):
    raise HTTPException(status_code=401, detail='Missing bearer token')

  token = authorization.split(' ', 1)[1].strip()
  if not token:
    raise HTTPException(status_code=401, detail='Missing bearer token')

  return token


def _is_uuid_like(value: str) -> bool:
  try:
    uuid.UUID(str(value))
    return True
  except Exception:
    return False


def _to_float(value: Any) -> float:
  try:
    return float(value)
  except Exception:
    return 0.0


def _to_int(value: Any) -> int:
  try:
    return int(value)
  except Exception:
    return 0


def _parse_datetime(value: Any) -> Optional[datetime]:
  if not isinstance(value, str):
    return None
  try:
    raw = value.strip()
    if raw.endswith('Z'):
      raw = raw[:-1] + '+00:00'
    return datetime.fromisoformat(raw)
  except Exception:
    return None


def _is_in_stock(row: Dict[str, Any]) -> bool:
  track_raw = row.get('track_quantity')
  track = True if track_raw is None else bool(track_raw)
  if not track:
    return True
  try:
    return int(row.get('quantity') or 0) > 0
  except Exception:
    return True


def _top_keys(scores: Dict[str, float], k: int, min_score: float = 0.0) -> List[str]:
  ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
  return [str(key) for key, score in ranked if score > min_score][:k]


def _map_product_row(row: Dict[str, Any]) -> Dict[str, Any]:
  compare_at_raw = row.get('compare_at_price')
  track_quantity_raw = row.get('track_quantity')
  is_featured_raw = row.get('is_featured')
  is_active_raw = row.get('is_active')

  images_raw = row.get('images')
  tags_raw = row.get('tags')
  specifications_raw = row.get('specifications')

  category_raw = row.get('category_id')
  category_id = str(category_raw) if category_raw is not None else None

  return {
    'id': str(row.get('id') or ''),
    'name': row.get('name') or '',
    'slug': row.get('slug'),
    'description': row.get('description'),
    'price': _to_float(row.get('price')),
    'compareAtPrice': _to_float(compare_at_raw) if compare_at_raw is not None else None,
    'sku': row.get('sku'),
    'quantity': _to_int(row.get('quantity')),
    'trackQuantity': bool(track_quantity_raw) if track_quantity_raw is not None else True,
    'categoryId': category_id,
    'brand': row.get('brand'),
    'mainImage': row.get('main_image'),
    'images': images_raw if isinstance(images_raw, list) else [],
    'specifications': specifications_raw if isinstance(specifications_raw, dict) else {},
    'tags': tags_raw if isinstance(tags_raw, list) else [],
    'rating': _to_float(row.get('rating')),
    'reviewsCount': _to_int(row.get('reviews_count')),
    'isFeatured': bool(is_featured_raw) if is_featured_raw is not None else False,
    'isActive': bool(is_active_raw) if is_active_raw is not None else True,
    'createdAt': row.get('created_at'),
    'updatedAt': row.get('updated_at'),
  }


async def _fetch_user_product_activity_events(user_id: str, token: str, limit: int = 200) -> List[Dict[str, Any]]:
  if not SUPABASE_URL or not SUPABASE_API_KEY:
    return []

  safe_limit = max(1, min(int(limit), 500))
  url = f"{SUPABASE_URL}/rest/v1/user_activities"
  headers = {
    'apikey': SUPABASE_API_KEY,
    'Authorization': f'Bearer {token}',
  }

  async with httpx.AsyncClient(timeout=10.0) as client:
    attempts = [
      {
        'select': 'entity_id,entity_type,action_type,created_at',
        'user_id': f'eq.{user_id}',
        'entity_type': 'eq.product',
        'action_type': 'in.(product_view,cart_add,favorite_add,cart_remove,favorite_remove)',
        'order': 'created_at.desc',
        'limit': str(safe_limit),
      },
      {
        'select': 'entity_id,entity_type,activity_type,created_at',
        'user_id': f'eq.{user_id}',
        'entity_type': 'eq.product',
        'activity_type': 'in.(product_view,cart_add,favorite_add,cart_remove,favorite_remove)',
        'order': 'created_at.desc',
        'limit': str(safe_limit),
      },
    ]

    for params in attempts:
      try:
        res = await client.get(url, headers=headers, params=params)
        if res.status_code != 200:
          continue

        data = res.json()
        if not isinstance(data, list):
          continue

        out: List[Dict[str, Any]] = []
        for row in data:
          if not isinstance(row, dict):
            continue
          if not row.get('entity_id'):
            continue
          out.append(row)

        if out:
          return out
      except Exception:
        continue

  return []


async def _fetch_user_product_views(user_id: str, token: str, limit: int = 100) -> List[str]:
  if not SUPABASE_URL or not SUPABASE_API_KEY:
    return []

  safe_limit = max(1, min(int(limit), 200))
  url = f"{SUPABASE_URL}/rest/v1/user_activities"
  headers = {
    'apikey': SUPABASE_API_KEY,
    'Authorization': f'Bearer {token}',
  }

  async with httpx.AsyncClient(timeout=10.0) as client:
    attempts = [
      {
        'select': 'entity_id,action_type,created_at',
        'user_id': f'eq.{user_id}',
        'action_type': 'eq.product_view',
        'order': 'created_at.desc',
        'limit': str(safe_limit),
      },
      {
        'select': 'entity_id,activity_type,created_at',
        'user_id': f'eq.{user_id}',
        'activity_type': 'eq.product_view',
        'order': 'created_at.desc',
        'limit': str(safe_limit),
      },
    ]

    for params in attempts:
      try:
        res = await client.get(url, headers=headers, params=params)
        if res.status_code != 200:
          continue

        data = res.json()
        if not isinstance(data, list):
          continue

        out: List[str] = []
        for row in data:
          if isinstance(row, dict) and row.get('entity_id'):
            out.append(str(row.get('entity_id')))

        if out:
          return out
      except Exception:
        continue

  return []


@app.get('/health')
async def health() -> Dict[str, str]:
  return {'status': 'ok'}


@app.get('/v1/me')
async def me(user: SupabaseUser = Depends(get_current_user)) -> Dict[str, Any]:
  return user.model_dump()


@app.get('/v1/products/top')
async def top_products(limit: int = 10) -> Dict[str, List[Dict[str, Any]]]:
  if supabase is None:
    raise HTTPException(status_code=500, detail='Supabase not configured')

  safe_limit = max(1, min(int(limit), 50))

  try:
    res = (
      supabase.table('products')
      .select('id,name,price,rating,reviews_count,main_image,category_id')
      .eq('is_active', True)
      .order('rating', desc=True)
      .limit(safe_limit)
      .execute()
    )
    items = res.data if isinstance(res.data, list) else []
    return {'items': items}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.get('/v1/recommendations')
async def recommendations(
  limit: int = 10,
  user: SupabaseUser = Depends(get_current_user),
  token: str = Depends(get_current_token),
) -> Dict[str, Any]:
  if supabase is None:
    raise HTTPException(status_code=500, detail='Supabase not configured')

  safe_limit = max(1, min(int(limit), 50))

  try:
    request_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    events = await _fetch_user_product_activity_events(user.id, token, limit=200)
    raw_ids: List[str] = []
    for evt in events:
      entity_id = evt.get('entity_id')
      if entity_id is None:
        continue
      entity_id_str = str(entity_id)
      if _is_uuid_like(entity_id_str):
        raw_ids.append(entity_id_str)

    interacted_ids = list(dict.fromkeys(raw_ids))

    product_meta_by_id: Dict[str, Dict[str, Any]] = {}
    if interacted_ids:
      prods = (
        supabase.table('products')
        .select('id,category_id,brand,tags')
        .in_('id', interacted_ids[:200])
        .execute()
      )
      for p in (prods.data or []):
        if not isinstance(p, dict):
          continue
        pid_raw = p.get('id')
        if pid_raw is None:
          continue
        pid_str = str(pid_raw)
        if not _is_uuid_like(pid_str):
          continue

        category_raw = p.get('category_id')
        category_str = str(category_raw) if category_raw is not None else None
        if category_str is not None and not _is_uuid_like(category_str):
          category_str = None

        brand_raw = p.get('brand')
        brand_str = str(brand_raw).strip() if brand_raw is not None else None
        if brand_str == '':
          brand_str = None

        tags_raw = p.get('tags')
        tags: List[str] = []
        if isinstance(tags_raw, list):
          for t in tags_raw:
            ts = str(t).strip()
            if ts:
              tags.append(ts)

        product_meta_by_id[pid_str] = {
          'category_id': category_str,
          'brand': brand_str,
          'tags': tags,
        }

    action_weights: Dict[str, float] = {
      'favorite_add': 5.0,
      'cart_add': 4.0,
      'product_view': 1.0,
      'favorite_remove': -2.0,
      'cart_remove': -1.0,
    }

    half_life_days = 14.0
    category_scores: Dict[str, float] = {}
    brand_scores: Dict[str, float] = {}
    tag_scores: Dict[str, float] = {}
    product_interest_scores: Dict[str, float] = {}
    for evt in events:
      entity_id = evt.get('entity_id')
      if entity_id is None:
        continue
      pid = str(entity_id)
      if not _is_uuid_like(pid):
        continue
      action_type = evt.get('action_type') or evt.get('activity_type')
      weight = action_weights.get(str(action_type), 0.0)
      if weight == 0.0:
        continue

      dt = _parse_datetime(evt.get('created_at'))
      if dt is None:
        recency = 1.0
      else:
        age_days = max(0.0, (now - dt.astimezone(timezone.utc)).total_seconds() / 86400.0)
        recency = math.pow(0.5, age_days / half_life_days)

      w = weight * recency

      if w > 0.0:
        product_interest_scores[pid] = product_interest_scores.get(pid, 0.0) + w

      meta = product_meta_by_id.get(pid)
      if not meta:
        continue

      category_id = meta.get('category_id')
      if category_id:
        category_scores[str(category_id)] = category_scores.get(str(category_id), 0.0) + w

      brand = meta.get('brand')
      if brand:
        brand_scores[str(brand)] = brand_scores.get(str(brand), 0.0) + w

      tags = meta.get('tags') or []
      if isinstance(tags, list) and tags:
        share = w / max(1, len(tags))
        for tag in tags:
          tag_scores[str(tag)] = tag_scores.get(str(tag), 0.0) + share

    top_categories = _top_keys(category_scores, 5, min_score=0.0)
    top_brands = _top_keys(brand_scores, 5, min_score=0.0)
    top_tags = _top_keys(tag_scores, 15, min_score=0.0)
    top_tag_set = set(top_tags)

    fetch_limit = max(safe_limit * 8, 40)
    select_cols = '*'

    candidates: List[Dict[str, Any]] = []
    source_parts: List[str] = []
    trending_view_counts: Dict[str, int] = {}

    cooccur_scores: Dict[str, float] = {}
    cooccur_seed_products = _top_keys(product_interest_scores, 20, min_score=0.0)
    if SUPABASE_SERVICE_ROLE_KEY:
      try:
        tv = (
          supabase.table('top_viewed_products')
          .select('product_id,view_count')
          .limit(fetch_limit)
          .execute()
        )
        if isinstance(tv.data, list):
          for row in tv.data:
            if not isinstance(row, dict):
              continue
            pid_raw = row.get('product_id')
            if pid_raw is None:
              continue
            pid = str(pid_raw)
            if not _is_uuid_like(pid):
              continue
            trending_view_counts[pid] = _to_int(row.get('view_count'))
      except Exception:
        trending_view_counts = {}

      if cooccur_seed_products:
        try:
          sim_res = (
            supabase.table('product_similar_products')
            .select('product_id,similar_product_id,common_users,similarity')
            .in_('product_id', cooccur_seed_products[:20])
            .order('similarity', desc=True)
            .limit(1000)
            .execute()
          )
          if isinstance(sim_res.data, list):
            for row in sim_res.data:
              if not isinstance(row, dict):
                continue

              seed_raw = row.get('product_id')
              cand_raw = row.get('similar_product_id')
              if seed_raw is None or cand_raw is None:
                continue

              seed = str(seed_raw)
              cand = str(cand_raw)
              if not _is_uuid_like(seed) or not _is_uuid_like(cand):
                continue

              if cand in interacted_ids:
                continue

              sim = _to_float(row.get('similarity'))
              common_users = _to_int(row.get('common_users'))
              if sim <= 0.0 or common_users <= 0:
                continue

              seed_strength = product_interest_scores.get(seed, 0.0)
              if seed_strength <= 0.0:
                continue

              cooccur_scores[cand] = cooccur_scores.get(cand, 0.0) + (sim * seed_strength * math.log1p(common_users))
        except Exception:
          cooccur_scores = {}

      if cooccur_scores:
        cooccur_fetch_limit = min(max(fetch_limit, safe_limit * 10, 120), 300)
        cooccur_candidate_ids = _top_keys(cooccur_scores, cooccur_fetch_limit, min_score=0.0)
        if cooccur_candidate_ids:
          res = (
            supabase.table('products')
            .select(select_cols)
            .eq('is_active', True)
            .in_('id', cooccur_candidate_ids)
            .limit(cooccur_fetch_limit)
            .execute()
          )
          if isinstance(res.data, list):
            candidates.extend(res.data)
            if res.data:
              source_parts.append('cooccurrence')

    if top_categories:
      res = (
        supabase.table('products')
        .select(select_cols)
        .eq('is_active', True)
        .in_('category_id', top_categories)
        .order('rating', desc=True)
        .limit(fetch_limit)
        .execute()
      )
      if isinstance(res.data, list):
        candidates.extend(res.data)
        if res.data:
          source_parts.append('category_affinity')

    if top_brands:
      res = (
        supabase.table('products')
        .select(select_cols)
        .eq('is_active', True)
        .in_('brand', top_brands)
        .order('rating', desc=True)
        .limit(fetch_limit)
        .execute()
      )
      if isinstance(res.data, list):
        candidates.extend(res.data)
        if res.data:
          source_parts.append('brand_affinity')

    if not candidates and trending_view_counts:
      trending_ids = list(trending_view_counts.keys())
      res = (
        supabase.table('products')
        .select(select_cols)
        .eq('is_active', True)
        .in_('id', trending_ids)
        .limit(fetch_limit)
        .execute()
      )
      if isinstance(res.data, list):
        candidates.extend(res.data)
        if res.data:
          source_parts.append('trending_views')

    if not candidates:
      res = (
        supabase.table('products')
        .select(select_cols)
        .eq('is_active', True)
        .order('reviews_count', desc=True)
        .order('rating', desc=True)
        .limit(fetch_limit)
        .execute()
      )
      if isinstance(res.data, list):
        candidates = res.data
        if res.data:
          source_parts.append('popular')

    if candidates:
      by_id: Dict[str, Dict[str, Any]] = {}
      for p in candidates:
        if not isinstance(p, dict):
          continue
        pid = str(p.get('id') or '')
        if not pid:
          continue
        if pid not in by_id:
          by_id[pid] = p
      candidates = list(by_id.values())

    seen = set(interacted_ids)
    scored: List[Dict[str, Any]] = []
    for p in candidates:
      if not isinstance(p, dict):
        continue
      pid = str(p.get('id') or '')
      if not pid or pid in seen:
        continue

      if not _is_in_stock(p):
        continue

      category_id = p.get('category_id')
      category_weight = category_scores.get(str(category_id), 0.0) if category_id is not None else 0.0
      brand = p.get('brand')
      brand_weight = brand_scores.get(str(brand), 0.0) if brand is not None else 0.0

      tags_raw = p.get('tags')
      tag_weight = 0.0
      tag_overlap = 0
      if isinstance(tags_raw, list):
        for t in tags_raw:
          ts = str(t).strip()
          if not ts:
            continue
          tag_weight += tag_scores.get(ts, 0.0)
          if ts in top_tag_set:
            tag_overlap += 1

      rating = _to_float(p.get('rating'))
      reviews_count = _to_int(p.get('reviews_count'))
      is_featured = bool(p.get('is_featured'))

      trending_views = trending_view_counts.get(pid, 0)
      cooccur_weight = cooccur_scores.get(pid, 0.0)

      base = (rating * 2.0) + math.log1p(max(0, reviews_count)) + (1.0 if is_featured else 0.0)
      score = (
        base
        + (category_weight * 3.0)
        + (brand_weight * 2.0)
        + (tag_weight * 1.5)
        + (tag_overlap * 0.25)
        + (math.log1p(max(0, trending_views)) * 0.5)
        + (cooccur_weight * 2.0)
      )
      scored.append({'score': score, 'product': p})

    scored.sort(key=lambda x: (-x['score'], str(x['product'].get('id') or '')))

    out_rows: List[Dict[str, Any]] = []
    for item in scored:
      out_rows.append(_map_product_row(item['product']))
      if len(out_rows) >= safe_limit:
        break

    if len(out_rows) < safe_limit:
      seen_all = seen.union({r.get('id') for r in out_rows if r.get('id')})
      for p in candidates:
        if not isinstance(p, dict):
          continue
        pid = str(p.get('id') or '')
        if not pid or pid in seen_all:
          continue
        if not _is_in_stock(p):
          continue
        out_rows.append(_map_product_row(p))
        if len(out_rows) >= safe_limit:
          break

    return {
      'user_id': user.id,
      'items': out_rows,
      'meta': {
        'algorithm': 'v3_affinity_cooccurrence',
        'source': '+'.join(source_parts) if source_parts else 'popular',
        'request_id': request_id,
        'generated_at': now.isoformat(),
        'top_categories': top_categories,
        'top_brands': top_brands,
        'top_tags': top_tags[:10],
        'seen_count': len(seen),
        'cooccurrence_seed_count': len(cooccur_seed_products),
        'cooccurrence_scored_count': len(cooccur_scores),
      },
    }
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
