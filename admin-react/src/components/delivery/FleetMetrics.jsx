import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Truck, Activity, AlertTriangle, Package, Clock, TrendingUp } from 'lucide-react';

const MetricCard = ({ icon: Icon, label, value, subtitle, color, trend, pulse }) => {
  const colorClasses = {
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${colorClasses[color] || colorClasses.blue}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={18} />
            <span className="text-xs font-semibold uppercase opacity-70">{label}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${pulse ? 'animate-pulse' : ''}`}>
              {value}
            </span>
            {trend !== undefined && trend !== 0 && (
              <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? '+' : ''}{trend}
              </span>
            )}
          </div>
          <p className="text-xs mt-1 opacity-60">{subtitle}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default function FleetMetrics({ drivers, orders, locations }) {
  const metrics = useMemo(() => {
    const now = new Date();
    
    // Livreurs en ligne (position <5 min)
    const onlineDrivers = drivers.filter(d => {
      const loc = locations.find(l => l.driver_id === d.id);
      if (!loc) return false;
      const diff = (now - new Date(loc.captured_at)) / 1000 / 60;
      return diff < 5;
    });
    
    // Livreurs hors ligne (>10 min)
    const offlineDrivers = drivers.filter(d => {
      const loc = locations.find(l => l.driver_id === d.id);
      if (!loc) return true;
      const diff = (now - new Date(loc.captured_at)) / 1000 / 60;
      return diff >= 10;
    });
    
    // Livreurs surchargés (≥5 livraisons actives)
    const overloadedDrivers = drivers.filter(d => {
      const driverOrders = orders.filter(o => 
        o.driver_id === d.id && 
        ['confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status)
      );
      return driverOrders.length >= 5;
    });
    
    // Livraisons en retard SLA (>2h)
    const lateDeliveries = orders.filter(o => {
      if (['delivered', 'cancelled'].includes(o.status)) return false;
      const created = new Date(o.created_at);
      const diff = (now - created) / 1000 / 60 / 60;
      return diff > 2;
    });
    
    // Livraisons actives
    const activeDeliveries = orders.filter(o => 
      ['confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status)
    );
    
    return {
      totalDrivers: drivers.length,
      onlineDrivers: onlineDrivers.length,
      offlineDrivers: offlineDrivers.length,
      overloadedDrivers: overloadedDrivers.length,
      lateDeliveries: lateDeliveries.length,
      activeDeliveries: activeDeliveries.length,
      overloadedDriversList: overloadedDrivers,
      lateDeliveriesList: lateDeliveries,
    };
  }, [drivers, orders, locations]);

  return (
    <div className="space-y-4">
      {/* Métriques principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={Truck}
          label="Flotte"
          value={metrics.totalDrivers}
          subtitle="livreurs"
          color="purple"
        />
        <MetricCard
          icon={Activity}
          label="En ligne"
          value={metrics.onlineDrivers}
          subtitle="actifs"
          color="green"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Hors ligne"
          value={metrics.offlineDrivers}
          subtitle="> 10 min"
          color="orange"
        />
        <MetricCard
          icon={Package}
          label="Surchargés"
          value={metrics.overloadedDrivers}
          subtitle="≥ 5 liv."
          color="red"
        />
        <MetricCard
          icon={Clock}
          label="En retard (SLA)"
          value={metrics.lateDeliveries}
          subtitle="> 2h"
          color="red"
          pulse={metrics.lateDeliveries > 0}
        />
        <MetricCard
          icon={TrendingUp}
          label="Livraisons"
          value={metrics.activeDeliveries}
          subtitle="en cours"
          color="blue"
        />
      </div>

      {/* Alertes critiques */}
      {(metrics.overloadedDrivers > 0 || metrics.lateDeliveries > 0) && (
        <div className="space-y-2">
          {metrics.overloadedDriversList.map(driver => {
            const driverOrders = orders.filter(o => 
              o.driver_id === driver.id && 
              ['confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status)
            );
            return (
              <motion.div
                key={driver.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3"
              >
                <Package className="text-red-600 dark:text-red-400" size={20} />
                <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                  {driver.name} surchargé ({driverOrders.length} livraisons)
                </span>
              </motion.div>
            );
          })}
          
          {metrics.lateDeliveriesList.map(order => {
            const driver = drivers.find(d => d.id === order.driver_id);
            const created = new Date(order.created_at);
            const diff = ((new Date() - created) / 1000 / 60 / 60).toFixed(1);
            
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center gap-3"
              >
                <Clock className="text-orange-600 dark:text-orange-400" size={20} />
                <span className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                  {driver?.name || 'Livreur'} : {order.order_number || order.id.slice(0, 8)} — {order.customer_name || 'Client'} ({diff}h en retard)
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
