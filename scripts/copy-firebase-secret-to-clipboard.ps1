# Copie le contenu du fichier de clé Firebase dans le presse-papiers.
# Ensuite : Supabase Dashboard > Project Settings > Edge Functions > Secrets > FIREBASE_SERVICE_ACCOUNT > Coller (Ctrl+V).

$ErrorActionPreference = "Stop"
$keyPath = Join-Path $PSScriptRoot "..\android\app\globalbusinessamdaradir-fba45-firebase-adminsdk-fbsvc-0b9bbafd71.json"
if (-not (Test-Path $keyPath)) {
    Write-Error "Fichier introuvable: $keyPath"
    exit 1
}
$json = Get-Content -Raw -Path $keyPath -Encoding UTF8
Set-Clipboard -Value $json
Write-Host "Contenu du fichier JSON copie dans le presse-papiers."
Write-Host "Ouvrez : https://supabase.com/dashboard/project/uvlrgwdbjegoavjfdrzb/settings/functions"
Write-Host "Onglet Secrets > FIREBASE_SERVICE_ACCOUNT > Collez (Ctrl+V) puis Enregistrez."
