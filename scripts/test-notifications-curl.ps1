# Test notifications push : Connexion -> Liste tokens -> Envoi notification
# Usage (racine du projet) :
#   $env:SUPABASE_ANON_KEY = "votre_cle_anon"
#   .\scripts\test-notifications-curl.ps1

$ErrorActionPreference = "Stop"
$base = "https://uvlrgwdbjegoavjfdrzb.supabase.co"

if (-not $env:SUPABASE_ANON_KEY) {
    $env:SUPABASE_ANON_KEY = Read-Host "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzI3ODYsImV4cCI6MjA3MTgwODc4Nn0.ZuMcEKbCKo5CtQGdn2KAHqHfBdROpvtLp7nJpJSHOUQ"
}
$anonKey = $env:SUPABASE_ANON_KEY.Trim()
if ([string]::IsNullOrWhiteSpace($anonKey)) {
    Write-Error "SUPABASE_ANON_KEY est vide."
    exit 1
}

Write-Host "1. Connexion..." -ForegroundColor Cyan
$loginBody = '{"email":"freeanimations2@gmail.com","password":"freeanimations2@gmail.com"}'
$loginResp = Invoke-RestMethod -Uri "$base/auth/v1/token?grant_type=password" -Method Post `
    -Headers @{ "apikey" = $anonKey; "Content-Type" = "application/json" } `
    -Body $loginBody

$accessToken = $loginResp.access_token
$userId = $loginResp.user.id
if (-not $accessToken -or -not $userId) {
    Write-Error "Connexion echouee. Verifiez la cle anon et les identifiants."
    exit 1
}
Write-Host "   OK - user_id: $userId" -ForegroundColor Green

Write-Host "2. Liste des tokens appareils..." -ForegroundColor Cyan
try {
    $tokensResp = Invoke-RestMethod -Uri "$base/rest/v1/device_tokens?select=id,user_id,token,platform,last_seen_at" -Method Get `
        -Headers @{
            "apikey"        = $anonKey
            "Authorization" = "Bearer $accessToken"
            "Content-Type"  = "application/json"
        }
    if ($tokensResp -is [array]) {
        Write-Host "   OK - $($tokensResp.Count) token(s)" -ForegroundColor Green
        $tokensResp | Select-Object -First 5 | Format-Table id, user_id, platform -AutoSize
        if ($tokensResp.Count -gt 5) { Write-Host "   ... et $($tokensResp.Count - 5) autre(s)" -ForegroundColor Gray }
    } else {
        Write-Host "   OK - $tokensResp" -ForegroundColor Green
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $body = $reader.ReadToEnd()
    Write-Host "   ERREUR $statusCode : $body" -ForegroundColor Red
    if ($body -match "Invalid API key") {
        Write-Host "   -> Verifiez que la cle anon est correcte (Dashboard > Project Settings > API > anon public)" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "3. Envoi notification de test..." -ForegroundColor Cyan
# JSON brut, envoye en octets UTF-8 sans BOM (PowerShell peut ajouter un BOM sinon)
$notifBody = '{"type":"__passthrough","user_ids":["' + $userId + '"],"title":"Test script PowerShell","body":"Notification envoyee depuis test-notifications-curl.ps1","data":{"route":"/home","category":"test"}}'
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($notifBody)

try {
    $notifResp = Invoke-RestMethod -Uri "$base/functions/v1/send-push-notification" -Method Post `
        -Headers @{
            "Authorization" = "Bearer $anonKey"
            "Content-Type"  = "application/json"
        } `
        -Body $bodyBytes
    $sent = $notifResp.sent
    $total = if ($null -ne $notifResp.total_tokens) { $notifResp.total_tokens } else { 0 }
    $errs = $notifResp.errors
    if ($sent -gt 0) {
        Write-Host "   OK - envoye a $sent/$total appareil(s)" -ForegroundColor Green
    } else {
        if ($total -eq 0) {
            Write-Host "   OK - requete acceptee, mais aucun token pour cet utilisateur (no device tokens)" -ForegroundColor Yellow
            Write-Host "   -> Utilisez l'APPLICATION MOBILE Flutter (APK Android / iOS), pas le site web." -ForegroundColor Gray
            Write-Host "   -> Sur telephone : ouvrez l'app GBA, connectez-vous avec freeanimations2@gmail.com, laissez l'app ouverte 5 s, puis reessayez." -ForegroundColor Gray
        } else {
            Write-Host "   OK - requete acceptee, mais 0 notification envoyee (total_tokens: $total)" -ForegroundColor Yellow
            if ($errs -and $errs.Count -gt 0) {
                Write-Host "   Erreurs FCM : $($errs -join ', ')" -ForegroundColor Yellow
                if ($errs -match 'UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT') {
                    Write-Host "   -> Token(s) invalide(s) ou expire(s). Deconnectez-vous puis reconnectez-vous dans l'app, puis reessayez." -ForegroundColor Gray
                }
            }
        }
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $body = $reader.ReadToEnd()
    } catch { $body = $_.Exception.Message }
    Write-Host "   ERREUR $statusCode : $body" -ForegroundColor Red
    if ($body -match "BOOT_ERROR") {
        Write-Host "   -> Fonction Edge qui ne demarre pas. Verifiez :" -ForegroundColor Yellow
        Write-Host "      1. Secret FIREBASE_SERVICE_ACCOUNT (supabase secrets set)" -ForegroundColor Yellow
        Write-Host "      2. Redepoiement : supabase functions deploy send-push-notification" -ForegroundColor Yellow
        Write-Host "      3. Logs : Dashboard > Edge Functions > send-push-notification > Logs" -ForegroundColor Yellow
    }
    if ($body -match "Invalid FIREBASE_SERVICE_ACCOUNT") {
        Write-Host "   -> Secret Firebase invalide (JSON mal formate). Utilisez le Dashboard Supabase :" -ForegroundColor Yellow
        Write-Host "      Project Settings > Edge Functions > Secrets > FIREBASE_SERVICE_ACCOUNT" -ForegroundColor Yellow
        Write-Host "      Coller le contenu brut du fichier .json (voir docs/FCM_V1_SETUP.md)" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "Termine." -ForegroundColor Green
