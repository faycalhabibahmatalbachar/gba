import asyncio
import datetime
import json
from pathlib import Path
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://uvlrgwdbjegoavjfdrzb.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE0MDksImV4cCI6MjA1MTA4NzQwOX0.XWQM6dm4Mg5tQ_z8MvMG1wqzAzedv9M0TeYikblGUzA')

# Initialiser le client Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class MonitoringService:
    def __init__(self, output_file='monitor.txt'):
        self.output_file = Path(output_file)
        self.is_running = False
        
    def write_log(self, message):
        """Écrire un message dans le fichier monitor.txt"""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}\n"
        
        # Ajouter au fichier
        with open(self.output_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)
        
        # Afficher aussi dans la console
        print(log_entry.strip())
    
    async def monitor_users(self):
        """Surveiller les activités utilisateurs"""
        try:
            # Récupérer les statistiques utilisateurs
            response = supabase.table('profiles').select('*').execute()
            total_users = len(response.data) if response.data else 0
            
            # Récupérer les utilisateurs actifs (connectés dans les dernières 24h)
            yesterday = (datetime.datetime.now() - datetime.timedelta(days=1)).isoformat()
            active_response = supabase.table('user_connections')\
                .select('user_id')\
                .gte('connected_at', yesterday)\
                .execute()
            active_users = len(set([u['user_id'] for u in active_response.data])) if active_response.data else 0
            
            self.write_log(f"📊 STATS UTILISATEURS: Total={total_users}, Actifs(24h)={active_users}")
            
        except Exception as e:
            self.write_log(f"❌ ERREUR monitor_users: {str(e)}")
    
    async def monitor_orders(self):
        """Surveiller les commandes"""
        try:
            # Commandes du jour
            today = datetime.datetime.now().date().isoformat()
            response = supabase.table('orders')\
                .select('*')\
                .gte('created_at', today)\
                .execute()
            
            if response.data:
                total_orders = len(response.data)
                total_amount = sum(order.get('total_amount', 0) for order in response.data)
                self.write_log(f"🛒 COMMANDES AUJOURD'HUI: {total_orders} commandes, Total: {total_amount:.2f}€")
            else:
                self.write_log("🛒 COMMANDES: Aucune commande aujourd'hui")
                
        except Exception as e:
            self.write_log(f"❌ ERREUR monitor_orders: {str(e)}")
    
    async def monitor_products(self):
        """Surveiller les produits et stocks"""
        try:
            # Produits avec stock faible
            response = supabase.table('products')\
                .select('name, stock')\
                .lt('stock', 10)\
                .execute()
            
            if response.data:
                low_stock = [f"{p['name']} ({p['stock']})" for p in response.data[:5]]
                self.write_log(f"⚠️ STOCK FAIBLE: {', '.join(low_stock)}")
            else:
                self.write_log("✅ STOCKS: Tous les produits ont un stock suffisant")
                
        except Exception as e:
            self.write_log(f"❌ ERREUR monitor_products: {str(e)}")
    
    async def monitor_activities(self):
        """Surveiller les activités récentes"""
        try:
            # Dernières activités
            response = supabase.table('user_activities')\
                .select('activity_type, details, created_at')\
                .order('created_at', desc=True)\
                .limit(5)\
                .execute()
            
            if response.data:
                self.write_log("📱 ACTIVITÉS RÉCENTES:")
                for activity in response.data:
                    act_type = activity.get('activity_type', 'Unknown')
                    details = json.loads(activity.get('details', '{}'))
                    time = activity.get('created_at', '')
                    self.write_log(f"  • {act_type}: {details.get('product_name', details.get('message', 'N/A'))}")
            
        except Exception as e:
            self.write_log(f"❌ ERREUR monitor_activities: {str(e)}")
    
    async def run_monitoring_cycle(self):
        """Exécuter un cycle complet de monitoring"""
        self.write_log("=" * 60)
        self.write_log("🔄 DÉBUT DU CYCLE DE MONITORING")
        
        # Exécuter toutes les vérifications
        await self.monitor_users()
        await self.monitor_orders()
        await self.monitor_products()
        await self.monitor_activities()
        
        self.write_log("✅ FIN DU CYCLE DE MONITORING")
        self.write_log("=" * 60)
    
    async def start(self, interval_seconds=60):
        """Démarrer le service de monitoring"""
        self.is_running = True
        self.write_log("🚀 SERVICE DE MONITORING DÉMARRÉ")
        self.write_log(f"⏰ Intervalle de rafraîchissement: {interval_seconds} secondes")
        
        while self.is_running:
            try:
                await self.run_monitoring_cycle()
                await asyncio.sleep(interval_seconds)
            except KeyboardInterrupt:
                self.write_log("🛑 ARRÊT DU MONITORING (Interruption utilisateur)")
                break
            except Exception as e:
                self.write_log(f"❌ ERREUR CRITIQUE: {str(e)}")
                await asyncio.sleep(10)  # Attendre avant de réessayer

async def main():
    """Fonction principale"""
    monitor = MonitoringService('monitor.txt')
    
    # Vider le fichier au démarrage
    with open('monitor.txt', 'w', encoding='utf-8') as f:
        f.write(f"MONITORING GBA - Démarré le {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 60 + "\n")
    
    # Démarrer le monitoring avec un intervalle de 30 secondes
    await monitor.start(interval_seconds=30)

if __name__ == "__main__":
    asyncio.run(main())
