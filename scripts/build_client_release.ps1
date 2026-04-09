param(
  [string]$DefinesFile = "dart_defines.json"
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing clean client flavor build..." -ForegroundColor Cyan

if (-not (Test-Path $DefinesFile)) {
  throw "Missing $DefinesFile. Copy dart_defines.example.json and fill secrets."
}

if (Test-Path "build/app/intermediates/flutter/clientRelease") {
  Remove-Item -Recurse -Force "build/app/intermediates/flutter/clientRelease"
}

if (Test-Path "build/app/intermediates/merged_assets/clientRelease") {
  Remove-Item -Recurse -Force "build/app/intermediates/merged_assets/clientRelease"
}

flutter clean
flutter pub get
flutter build apk --flavor client -t lib/main.dart --dart-define-from-file=$DefinesFile

Write-Host "Client APK build completed." -ForegroundColor Green
