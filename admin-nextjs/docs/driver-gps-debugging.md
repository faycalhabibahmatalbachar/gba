# Driver GPS tracking — Debugging & Fixes

## Goal
Ensure the driver mobile app continuously sends GPS positions to Supabase `driver_locations` (foreground + background) so the admin `/delivery-tracking` map receives live updates.

## Symptoms
- Admin dashboard showed **“Aucune position reçue”**.
- Supabase table `driver_locations` stayed empty even though the driver app UI showed GPS coordinates.

## Root cause
Two problems were interacting:

### 1) Location permission was denied
Logs showed:
- `User denied permissions to access the device's location.`

When location permission is denied, **no GPS stream starts**, so **no upsert** is attempted.

### 2) Permission request race / concurrent permission requests
Logs showed:
- `PlatformException(PermissionHandler.PermissionManager, A request for permissions is already running...)`

This occurred because permissions were requested from multiple places nearly simultaneously:
- background service startup (`LocationBackgroundService.startService()` -> `_ensurePermissions()`)
- driver foreground tracking (`DriverLocationService.startTracking()`)

This race could prevent the background service from starting and could also destabilize the tracking flow.

## Fix implemented (code)
File:
- `lib/services/location_background_service.dart`

Changes:
- Added a mutex flag `_permissionRequestInFlight` to prevent concurrent permission requests.
- Updated `_ensurePermissions()` to request **only** `Permission.location`.
- Stopped automatically requesting `Permission.locationAlways` inside `_ensurePermissions()` (this often triggers the concurrent-request crash on Android).
- Added an optional method `requestBackgroundLocationPermission()` to request `locationAlways` later from a deliberate UI moment.

Expected behavior after patch:
- No more `A request for permissions is already running` exceptions.
- If foreground location permission is granted, the background service can start safely.

## Fix implemented (configuration / user action)
On the Android device:
- Ensure the app permission **Location** is set to at least:
  - **Allow while using the app**

Optionally (for true background tracking):
- Set to **Allow all the time** (if Android allows it).

## Verification
### A) Log verification
Successful driver tracking logs:
- `[BGLocation] setDriverId → <uuid>`
- `[DriverGPS] sent: <lat>, <lng>`

### B) Supabase verification
The `driver_locations` table should contain at least one row per active driver (upsert by `driver_id`).

Example row observed:
- `driver_id`: `db6083f5-8406-4dd7-9ca7-65e22142a2a1`
- `lat/lng`: `12.102695 / 15.1094416`
- `accuracy`: `~9m`
- `captured_at/created_at`: present

## Remaining non-blocking issues (future work)
### 1) FCM device token schema mismatch
Logs show:
- `[DriverNotif] ❌ FCM token error: PostgrestException(... Could not find the 'app_type' column of 'device_tokens' ...)`

This does **not** block GPS tracking, but it prevents saving tokens for push notifications.

Fix options:
- Add `app_type` column to `device_tokens` table (if intended), OR
- Remove/stop sending `app_type` in the insert/upsert payload.

### 2) Driver chat RLS
Logs show:
- `[DriverChat] init error: new row violates row-level security policy for table "chat_conversations"`

Also not blocking GPS. Needs RLS policy review for driver chat creation.

## Checklist (quick)
- [ ] Driver app: Location permission granted
- [ ] No `permission request already running` exceptions
- [ ] `driver_locations` has rows and updates
- [ ] Admin `/delivery-tracking` receives live updates
