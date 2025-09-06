#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import time
import os
import sys
from datetime import datetime
import re
from pathlib import Path

# Configuration
MONITOR_FILE = Path("monitor.txt")
CHECK_INTERVAL = 2  # secondes
LOG_FILE = Path("monitor_status.txt")

# Couleurs pour terminal Windows
class Colors:
    RED = ''
    GREEN = ''
    YELLOW = ''
    BLUE = ''
    RESET = ''
    BOLD = ''

# Solutions automatiques pour les erreurs connues
ERROR_SOLUTIONS = {
    'erreur de connexion': [
        '1. Vérifier les clés API Supabase dans le fichier config',
        '2. Vérifier la connexion internet',
        '3. Tester avec test_messaging_connection.html',
        '4. Désactiver temporairement RLS dans Supabase'
    ],
    'failed to resolve import': [
        '1. Vérifier que le fichier importé existe',
        '2. Corriger le chemin d\'import',
        '3. Installer les dépendances manquantes avec npm install'
    ],
    'websocket': [
        '1. Vérifier que Realtime est activé dans Supabase',
        '2. Vérifier les permissions des tables',
        '3. Redémarrer le serveur'
    ]
}

def clear_screen():
    """Efface l'écran du terminal"""
    os.system('cls' if os.name == 'nt' else 'clear')

def log_status(message, status='INFO'):
    """Enregistre le statut dans un fichier"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] [{status}] {message}\n")

def analyze_content(content):
    """Analyse le contenu et propose des solutions"""
    content_lower = content.lower()
    solutions = []
    
    for error_key, error_solutions in ERROR_SOLUTIONS.items():
        if error_key in content_lower:
            solutions.extend(error_solutions)
    
    return solutions

def display_status(last_content, current_content, file_modified):
    """Affiche le statut actuel"""
    clear_screen()
    print("="* 60)
    print("🔍 MONITOR AUTOMATIQUE - Surveillance de monitor.txt")
    print("="* 60)
    print(f"⏰ Dernière vérification: {datetime.now().strftime('%H:%M:%S')}")
    print(f"📁 Fichier surveillé: {MONITOR_FILE}")
    print(f"🔄 Intervalle: {CHECK_INTERVAL} secondes")
    print("="* 60)
    
    if file_modified:
        print("\n⚠️  NOUVEAU CONTENU DÉTECTÉ !\n")
    
    if current_content:
        print("📋 Contenu actuel:")
        print("-" * 40)
        lines = current_content.strip().split('\n')
        for line in lines[:10]:  # Afficher max 10 lignes
            if 'erreur' in line.lower() or 'error' in line.lower():
                print(f"❌ {line}")
            elif 'correction' in line.lower() or 'fixed' in line.lower():
                print(f"✅ {line}")
            else:
                print(f"   {line}")
        if len(lines) > 10:
            print(f"   ... et {len(lines) - 10} lignes de plus")
        print("-" * 40)
        
        # Analyser et proposer des solutions
        solutions = analyze_content(current_content)
        if solutions:
            print("\n💡 SOLUTIONS PROPOSÉES:")
            for i, solution in enumerate(solutions, 1):
                print(f"   {solution}")
    else:
        print("\n📭 Le fichier est vide ou n'existe pas encore.")
    
    print("\n[Ctrl+C pour arrêter la surveillance]")

def monitor_file():
    """Surveille le fichier monitor.txt en continu"""
    print("🚀 Démarrage de la surveillance...")
    log_status("Surveillance démarrée", "START")
    
    last_content = ""
    last_modified = 0
    
    try:
        while True:
            try:
                # Vérifier si le fichier existe
                if MONITOR_FILE.exists():
                    # Vérifier la date de modification
                    current_modified = os.path.getmtime(MONITOR_FILE)
                    
                    # Lire le contenu
                    with open(MONITOR_FILE, 'r', encoding='utf-8') as f:
                        current_content = f.read()
                    
                    # Détecter les changements
                    file_modified = (current_modified != last_modified or 
                                   current_content != last_content)
                    
                    if file_modified:
                        log_status(f"Changement détecté: {len(current_content)} caractères", "CHANGE")
                        
                        # Détecter les erreurs spécifiques
                        if 'erreur de connexion' in current_content.lower():
                            log_status("Erreur de connexion détectée", "ERROR")
                            print("\n🚨 ALERTE: Erreur de connexion détectée!")
                            print("📝 Exécution des corrections automatiques...")
                            # Ici on pourrait lancer automatiquement des scripts de fix
                        
                        last_content = current_content
                        last_modified = current_modified
                    
                    # Afficher le statut
                    display_status(last_content, current_content, file_modified)
                    
                else:
                    display_status("", "", False)
                    print("\n⚠️  Le fichier monitor.txt n'existe pas encore.")
                    print("    Créez-le ou modifiez-le pour commencer la surveillance.")
                
                # Attendre avant la prochaine vérification
                time.sleep(CHECK_INTERVAL)
                
            except IOError as e:
                print(f"\n❌ Erreur de lecture: {e}")
                log_status(f"Erreur IO: {e}", "ERROR")
                time.sleep(CHECK_INTERVAL)
                
    except KeyboardInterrupt:
        print("\n\n👋 Surveillance arrêtée par l'utilisateur")
        log_status("Surveillance arrêtée", "STOP")
        sys.exit(0)

def main():
    """Fonction principale"""
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║         📡 SYSTÈME DE MONITORING AUTOMATIQUE              ║")
    print("║                   monitor.txt                             ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print()
    
    # Créer le fichier de log s'il n'existe pas
    if not LOG_FILE.exists():
        LOG_FILE.write_text("[MONITOR LOG START]\n", encoding='utf-8')
    
    # Créer monitor.txt s'il n'existe pas
    if not MONITOR_FILE.exists():
        print("📝 Création du fichier monitor.txt...")
        MONITOR_FILE.write_text("En attente d'erreurs...\n", encoding='utf-8')
    
    # Lancer la surveillance
    monitor_file()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Erreur fatale: {e}")
        log_status(f"Erreur fatale: {e}", "FATAL")
        sys.exit(1)
