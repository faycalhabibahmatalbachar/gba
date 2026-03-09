import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Package, MapPin } from 'lucide-react';

export default function AlertsPanel({ drivers, orders, locations }) {
  const alerts = useMemo(() => {
    const result = [];
    const now = new Date();

    // Détection livreurs surchargés
    drivers.forEach(driver => {
      const driverOrders = orders.filter(o => 
        o.driver_id === driver.id && 
        ['confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status)
      );
      
      if (driverOrders.length >= 5) {
        result.push({
          type: 'error',
          icon: Package,
          driver: driver.name,
          message: `${driver.name} surchargé (${driverOrders.length} livraisons)`,
          severity: 'high',
        });
      }
    });

    // Détection livraisons en retard SLA (>2h)
    orders.forEach(order => {
      if (['delivered', 'cancelled'].includes(order.status)) return;
      
      const created = new Date(order.created_at);
      const diff = (now - created) / 1000 / 60 / 60; // heures
      
      if (diff > 2) {
        const driver = drivers.find(d => d.id === order.driver_id);
        result.push({
          type: 'warning',
          icon: Clock,
          driver: driver?.name || 'Livreur inconnu',
          message: `${driver?.name || 'Livreur'} : ${order.order_number || order.id.slice(0, 8)} — ${order.customer_name || 'Client'} (${diff.toFixed(1)}h en retard)`,
          severity: 'medium',
          orderId: order.id,
        });
      }
    });

    // Détection livreurs immobiles (5 dernières positions identiques)
    drivers.forEach(driver => {
      const driverLocs = locations
        .filter(l => l.driver_id === driver.id)
        .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
        .slice(0, 5);
      
      if (driverLocs.length >= 5) {
        const allSame = driverLocs.every(l => 
          Math.abs(l.latitude - driverLocs[0].latitude) < 0.0001 &&
          Math.abs(l.longitude - driverLocs[0].longitude) < 0.0001
        );
        
        if (allSame) {
          const hasActiveOrders = orders.some(o => 
            o.driver_id === driver.id && 
            ['confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status)
          );
          
          if (hasActiveOrders) {
            result.push({
              type: 'warning',
              icon: MapPin,
              driver: driver.name,
              message: `${driver.name} immobile depuis 15+ min (livraison en cours)`,
              severity: 'medium',
            });
          }
        }
      }
    });

    // Trier par sévérité
    return result.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [drivers, orders, locations]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const Icon = alert.icon;
        const bgColor = alert.type === 'error' 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
          : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100';
        
        const iconColor = alert.type === 'error'
          ? 'text-red-600 dark:text-red-400'
          : 'text-orange-600 dark:text-orange-400';

        return (
          <motion.div
            key={`${alert.driver}-${i}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl border p-3 flex items-center gap-3 ${bgColor}`}
          >
            <Icon className={iconColor} size={20} />
            <span className="text-sm font-semibold flex-1">
              {alert.message}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
