# Tester les notifications avec cURL (sans Postman)

À faire depuis la racine du projet. Remplacez `VOTRE_ANON_KEY` par la clé **anon public** (Supabase Dashboard > Project Settings > API).

---

## 1. Connexion (récupérer le token)

**Windows (PowerShell) :**
```powershell
$headers = @{
  "apikey"       = "VOTRE_ANON_KEY"
  "Content-Type" = "application/json"
}
$body = '{"email":"freeanimations2@gmail.com","password":"freeanimations2@gmail.com"}'
$r = Invoke-RestMethod -Uri "https://uvlrgwdbjegoavjfdrzb.supabase.co/auth/v1/token?grant_type=password" -Method Post -Headers $headers -Body $body
$r.access_token
$r.user.id
```

**cURL (toute plateforme) :**
```bash
curl -s -X POST "https://uvlrgwdbjegoavjfdrzb.supabase.co/auth/v1/token?grant_type=password" ^
  -H "apikey: VOTRE_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"freeanimations2@gmail.com\",\"password\":\"freeanimations2@gmail.com\"}"
```
(Sur Linux/Mac : remplacer `^` par `\` en fin de ligne.)

Copier `access_token` et `user.id` de la réponse pour les étapes suivantes.

---

## 2. Liste des tokens d’appareils

Remplacez `VOTRE_ANON_KEY` et `ACCESS_TOKEN` (obtenu à l’étape 1).

**Windows (PowerShell) :**
```powershell
$headers = @{
  "apikey"        = "VOTRE_ANON_KEY"
  "Authorization" = "Bearer ACCESS_TOKEN"
  "Content-Type"  = "application/json"
}
Invoke-RestMethod -Uri "https://uvlrgwdbjegoavjfdrzb.supabase.co/rest/v1/device_tokens?select=id,user_id,token,platform,last_seen_at" -Method Get -Headers $headers
```

**cURL :**
```bash
curl -s -X GET "https://uvlrgwdbjegoavjfdrzb.supabase.co/rest/v1/device_tokens?select=id,user_id,token,platform,last_seen_at" ^
  -H "apikey: VOTRE_ANON_KEY" ^
  -H "Authorization: Bearer ACCESS_TOKEN" ^
  -H "Content-Type: application/json"
```

---

## 3. Envoyer une notification de test

Remplacez `VOTRE_ANON_KEY` et `USER_ID` (le `user.id` de l’étape 1).

**Windows (PowerShell) :**
```powershell
$headers = @{
  "Authorization" = "Bearer VOTRE_ANON_KEY"
  "Content-Type"  = "application/json"
}
$body = @{
  type    = "__passthrough"
  user_ids = @("USER_ID")
  title   = "Test cURL"
  body    = "Notification envoyée depuis cURL"
  data    = @{ route = "/home"; category = "test" }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "https://uvlrgwdbjegoavjfdrzb.supabase.co/functions/v1/send-push-notification" -Method Post -Headers $headers -Body $body
```

**cURL :**
```bash
curl -s -X POST "https://uvlrgwdbjegoavjfdrzb.supabase.co/functions/v1/send-push-notification" ^
  -H "Authorization: Bearer VOTRE_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"type\":\"__passthrough\",\"user_ids\":[\"USER_ID\"],\"title\":\"Test cURL\",\"body\":\"Notification envoyée depuis cURL\",\"data\":{\"route\":\"/home\",\"category\":\"test\"}}"
```

---

## Script PowerShell tout-en-un

Le script `scripts/test-notifications-curl.ps1` enchaîne les 3 étapes. À la racine du projet :

```powershell
$env:SUPABASE_ANON_KEY = "VOTRE_ANON_KEY"
.\scripts\test-notifications-curl.ps1
```

Ou le script vous demandera la clé si la variable n’est pas définie.
