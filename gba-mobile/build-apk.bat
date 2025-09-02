@echo off
echo ========================================
echo     GBA Mobile - Build APK Script
echo ========================================
echo.

REM Vérifier Java
echo [1/5] Vérification de Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERREUR: Java n'est pas installé ou JAVA_HOME n'est pas configuré
    echo Veuillez installer Java JDK 11 depuis https://adoptium.net
    pause
    exit /b 1
)
echo ✅ Java détecté

REM Nettoyer le cache
echo.
echo [2/5] Nettoyage du cache...
call npx react-native start --reset-cache --max-workers=1 &
timeout /t 5 >nul
taskkill /f /im node.exe >nul 2>&1
echo ✅ Cache nettoyé

REM Installer les dépendances
echo.
echo [3/5] Installation des dépendances...
call npm install
if errorlevel 1 (
    echo ❌ ERREUR lors de l'installation des dépendances
    pause
    exit /b 1
)
echo ✅ Dépendances installées

REM Nettoyer le build Android
echo.
echo [4/5] Nettoyage du build Android...
cd android
call gradlew.bat clean
if errorlevel 1 (
    echo ⚠️  Avertissement: Impossible de nettoyer le build
)
cd ..

REM Générer l'APK
echo.
echo [5/5] Génération de l'APK...
echo Cela peut prendre plusieurs minutes...
cd android
call gradlew.bat assembleRelease
if errorlevel 1 (
    echo ❌ ERREUR lors de la génération de l'APK
    cd ..
    pause
    exit /b 1
)
cd ..

REM Succès
echo.
echo ========================================
echo ✅ APK généré avec succès!
echo ========================================
echo.
echo 📱 Fichier APK disponible dans:
echo    android\app\build\outputs\apk\release\app-release.apk
echo.
echo Pour installer sur votre téléphone:
echo 1. Activez "Sources inconnues" dans les paramètres Android
echo 2. Transférez le fichier APK sur votre téléphone
echo 3. Ouvrez le fichier pour l'installer
echo.
pause
