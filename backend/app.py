import os
import uuid
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client


def _env(name: str) -> str:
  return os.getenv(name, '').strip()


SUPABASE_URL = _env('SUPABASE_URL')
SUPABASE_ANON_KEY = _env('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE_KEY = _env('SUPABASE_SERVICE_ROLE_KEY')


supabase: Optional[Client] = None
if SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY):
  supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)


class SupabaseUser(BaseModel):
  id: str
  email: Optional[str] = None


app = FastAPI()

origins_raw = _env('CORS_ALLOW_ORIGINS')
if not origins_raw:
  origins = ['*']
elif origins_raw == '*':
  origins = ['*']
else:
  origins = [o.strip() for o in origins_raw.split(',') if o.strip()]

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=False,
  allow_methods=['*'],
  allow_headers=['*'],
)


async def _fetch_supabase_user(token: str) -> Dict[str, Any]:
  if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise HTTPException(status_code=500, detail='Supabase auth not configured')

  url = f"{SUPABASE_URL}/auth/v1/user"
  async with httpx.AsyncClient(timeout=10.0) as client:
    res = await client.get(
      url,
      headers={
        'Authorization': f'Bearer {token}',
        'apikey': SUPABASE_ANON_KEY,
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


async def _fetch_user_product_views(user_id: str, token: str, limit: int = 100) -> List[str]:
  if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    return []

  safe_limit = max(1, min(int(limit), 200))
  url = f"{SUPABASE_URL}/rest/v1/user_activities"
  headers = {
    'apikey': SUPABASE_ANON_KEY,
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
    viewed_ids = await _fetch_user_product_views(user.id, token, limit=100)
    viewed_unique = list(dict.fromkeys([vid for vid in viewed_ids if _is_uuid_like(vid)]))

    categories: List[str] = []
    if viewed_unique:
      prods = (
        supabase.table('products')
        .select('category_id')
        .in_('id', viewed_unique[:50])
        .execute()
      )
      for p in (prods.data or []):
        category_id = p.get('category_id') if isinstance(p, dict) else None
        if category_id and _is_uuid_like(str(category_id)):
          categories.append(str(category_id))

    categories_unique = list(dict.fromkeys(categories))

    fetch_limit = max(safe_limit * 3, 30)

    candidates: List[Dict[str, Any]] = []
    if categories_unique:
      res = (
        supabase.table('products')
        .select('id,name,price,rating,reviews_count,main_image,category_id')
        .eq('is_active', True)
        .in_('category_id', categories_unique)
        .order('rating', desc=True)
        .limit(fetch_limit)
        .execute()
      )
      if isinstance(res.data, list):
        candidates = res.data

    if not candidates:
      res = (
        supabase.table('products')
        .select('id,name,price,rating,reviews_count,main_image,category_id')
        .eq('is_active', True)
        .order('rating', desc=True)
        .limit(fetch_limit)
        .execute()
      )
      if isinstance(res.data, list):
        candidates = res.data

    seen = set(viewed_unique)
    out: List[Dict[str, Any]] = []
    for p in candidates:
      pid = str(p.get('id', ''))
      if pid and pid not in seen:
        out.append(p)
      if len(out) >= safe_limit:
        break

    return {
      'user_id': user.id,
      'items': out,
    }
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
