@echo off
echo ========================================
echo     GBA Mobile - Build APK Manuel
echo ========================================
echo.

REM Configurer ANDROID_HOME si nécessaire
if not defined ANDROID_HOME (
    echo Configuration ANDROID_HOME...
    set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
)

echo [1/3] Nettoyage...
cd android
if exist .gradle (
    echo Suppression du cache local .gradle...
    rmdir /s /q .gradle
)

echo.
echo [2/3] Configuration Gradle hors-ligne...
echo org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 >> gradle.properties
echo org.gradle.daemon=true >> gradle.properties
echo org.gradle.parallel=true >> gradle.properties
echo org.gradle.configureondemand=true >> gradle.properties

echo.
echo [3/3] Build APK Release...
echo Cela peut prendre 5-10 minutes la première fois...
echo.

REM Utiliser gradlew avec timeout plus long
set GRADLE_OPTS=-Dorg.gradle.daemon.idletimeout=10800000
gradlew.bat assembleRelease --no-daemon --stacktrace

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ APK généré avec succès!
    echo ========================================
    echo.
    echo 📱 Fichier APK: 
    echo    android\app\build\outputs\apk\release\app-release.apk
    echo.
) else (
    echo.
    echo ❌ Erreur lors du build
    echo.
    echo Solutions possibles:
    echo 1. Vérifier votre connexion internet
    echo 2. Essayer avec un VPN
    echo 3. Télécharger Gradle manuellement depuis:
    echo    https://services.gradle.org/distributions/gradle-8.0.1-all.zip
    echo    Et l'extraire dans: %USERPROFILE%\.gradle\wrapper\dists\
    echo.
)

cd ..
pause
