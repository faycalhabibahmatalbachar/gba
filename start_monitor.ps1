# Script de monitoring GBA simplifié
$ErrorActionPreference = "Continue"

# Configuration
$SUPABASE_URL = "https://uvlrgwdbjegoavjfdrzb.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTQwNjU2NjksImV4cCI6MjA1MTA4NzQwOX0.XWQM6dm4Mg5tQ_z8MvMG1wqzAzedv9M0TeYikblGUzA"

# Fonction de log
function Write-Log {
    param($Message, $Type = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Type] $Message"
    Add-Content -Path "monitor_status.txt" -Value $logEntry -Encoding UTF8
    Write-Host $logEntry -ForegroundColor Cyan
}

# Headers API
$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

# Boucle principale
Clear-Content -Path "monitor.txt" -ErrorAction SilentlyContinue
Write-Log "SERVICE DE MONITORING DEMARRE"
Write-Log "================================"

while ($true) {
    Write-Log "--- NOUVEAU CYCLE ---"
    
    # Stats utilisateurs
    try {
        $users = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/profiles" -Headers $headers
        Write-Log "[USERS] Total utilisateurs: $($users.Count)"
    } catch {
        Write-Log "[ERREUR] Impossible de recuperer les utilisateurs"
    }
    
    # Commandes
    try {
        $today = Get-Date -Format "yyyy-MM-dd"
        $ordersUrl = "$SUPABASE_URL/rest/v1/orders?created_at=gte.$today"
        $orders = Invoke-RestMethod -Uri $ordersUrl -Headers $headers
        Write-Log "[ORDERS] Commandes aujourd'hui: $($orders.Count)"
    } catch {
        Write-Log "[ERREUR] Impossible de recuperer les commandes"
    }
    
    # Produits avec stock faible
    try {
        $productsUrl = "$SUPABASE_URL/rest/v1/products?stock=lt.10"
        $products = Invoke-RestMethod -Uri $productsUrl -Headers $headers
        if ($products.Count -gt 0) {
            Write-Log "[STOCK] $($products.Count) produits avec stock faible"
            $products[0..2] | ForEach-Object {
                Write-Log "  - $($_.name): $($_.stock) unites"
            }
        } else {
            Write-Log "[STOCK] Tous les stocks sont suffisants"
        }
    } catch {
        Write-Log "[ERREUR] Impossible de verifier les stocks"
    }
    
    Write-Log "--- FIN DU CYCLE ---"
    Write-Log ""
    
    # Attendre 30 secondes
    Start-Sleep -Seconds 30
}
