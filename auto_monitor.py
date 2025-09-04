import time
import json
import os
from datetime import datetime

def monitor_errors():
    """
    Script de surveillance automatique des erreurs Flutter
    Lit le fichier error_monitor.html pour récupérer les erreurs
    """
    print("🤖 Surveillance automatique démarrée")
    print("=" * 50)
    
    last_check = None
    
    while True:
        try:
            # Lire le localStorage simulé (fichier JSON)
            error_file = "error_log.json"
            
            if os.path.exists(error_file):
                with open(error_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    errors = data.get('errors', [])
                    
                    if errors and json.dumps(errors) != last_check:
                        print(f"\n🔴 NOUVELLES ERREURS DÉTECTÉES - {datetime.now().strftime('%H:%M:%S')}")
                        print("-" * 40)
                        
                        for error in errors[-3:]:  # Afficher les 3 dernières
                            error_type = error.get('type', 'unknown')
                            content = error.get('content', '')
                            timestamp = error.get('timestamp', '')
                            
                            if error_type == 'error':
                                icon = "❌"
                            elif error_type == 'bug':
                                icon = "🐛"
                            elif error_type == 'info':
                                icon = "ℹ️"
                            else:
                                icon = "✅"
                            
                            print(f"{icon} [{error_type.upper()}] {timestamp}")
                            print(f"   {content[:200]}...")  # Limiter à 200 caractères
                            print()
                        
                        last_check = json.dumps(errors)
                        
                        # Analyser les erreurs critiques
                        critical_errors = [e for e in errors if 'Exception' in e.get('content', '')]
                        if critical_errors:
                            print("⚠️ ERREURS CRITIQUES NÉCESSITANT UNE INTERVENTION:")
                            for err in critical_errors[-2:]:
                                print(f"   - {err['content'][:100]}...")
            
            else:
                # Créer le fichier s'il n'existe pas
                with open(error_file, 'w', encoding='utf-8') as f:
                    json.dump({'errors': [], 'lastUpdate': datetime.now().isoformat()}, f)
                print("📝 Fichier de log créé")
            
        except Exception as e:
            print(f"⚠️ Erreur de lecture: {e}")
        
        # Attendre 3 secondes avant la prochaine vérification
        time.sleep(3)

if __name__ == "__main__":
    try:
        monitor_errors()
    except KeyboardInterrupt:
        print("\n🛑 Surveillance arrêtée")
    except Exception as e:
        print(f"❌ Erreur fatale: {e}")
