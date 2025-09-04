# Script de surveillance automatique monitor.txt
# Surveille les nouvelles erreurs et alerte

$lastPosition = 0
$monitorFile = 'monitor.txt'
$checkInterval = 5 # secondes

Write-Host '🔍 Surveillance automatique de monitor.txt démarrée' -ForegroundColor Green
Write-Host 'Ctrl+C pour arrêter' -ForegroundColor Yellow
Write-Host ''

# Patterns à surveiller
$errorPatterns = @(
    'last_updated',
    'PostgrestException',
    'Exception:',
    'ERROR',
    'ERREUR',
    'failed',
    'HTTP request failed'
)

$knownIssues = @(
    'samsung-s24.jpg',
    'macbook.jpg', 
    'iphone15.jpg'
)

function Check-NewErrors {
    if (Test-Path $monitorFile) {
        $currentSize = (Get-Item $monitorFile).Length
        
        if ($currentSize -gt $lastPosition) {
            $newContent = Get-Content $monitorFile -Raw
            $newLines = $newContent.Substring([Math]::Min($lastPosition, $newContent.Length))
            
            foreach ($pattern in $errorPatterns) {
                if ($newLines -match $pattern) {
                    # Vérifier si c'est un problème connu
                    $isKnown = $false
                    foreach ($known in $knownIssues) {
                        if ($newLines -match $known) {
                            $isKnown = $true
                            break
                        }
                    }
                    
                    if (-not $isKnown) {
                        $timestamp = Get-Date -Format 'HH:mm:ss'
                        Write-Host "[$timestamp] ⚠️ NOUVELLE ERREUR DÉTECTÉE: $pattern" -ForegroundColor Red
                        
                        # Extraire les lignes concernées
                        $lines = $newLines -split "`n"
                        foreach ($line in $lines) {
                            if ($line -match $pattern) {
                                Write-Host "   > $line" -ForegroundColor Yellow
                            }
                        }
                    }
                }
            }
            
            $script:lastPosition = $currentSize
        }
    }
}

# Boucle de surveillance
while ($true) {
    Check-NewErrors
    Start-Sleep -Seconds $checkInterval
    
    # Afficher un point toutes les 30 secondes pour montrer que le script tourne
    if ((Get-Date).Second % 30 -eq 0) {
        Write-Host '.' -NoNewline -ForegroundColor Gray
    }
}
