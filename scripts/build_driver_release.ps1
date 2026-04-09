param(
  [string]$DefinesFile = "dart_defines.json"
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing clean driver flavor build..." -ForegroundColor Cyan

if (-not (Test-Path $DefinesFile)) {
  throw "Missing $DefinesFile. Copy dart_defines.example.json and fill secrets."
}

if (Test-Path "build/app/intermediates/flutter/driverRelease") {
  Remove-Item -Recurse -Force "build/app/intermediates/flutter/driverRelease"
}

if (Test-Path "build/app/intermediates/merged_assets/driverRelease") {
  Remove-Item -Recurse -Force "build/app/intermediates/merged_assets/driverRelease"
}

flutter clean
flutter pub get
flutter build apk --flavor driver -t lib/main_driver.dart --dart-define-from-file=$DefinesFile

Write-Host "Driver APK build completed." -ForegroundColor Green
