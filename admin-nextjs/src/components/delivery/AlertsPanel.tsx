import React, { useMemo, useState } from 'react';
import { Alert, Space, Tag, Button } from 'antd';
import { WarningOutlined, ClockCircleOutlined, CarOutlined } from '@ant-design/icons';
import type { DriverWithState, ActiveOrder } from '@/lib/services/delivery-tracking';

type Props = {
  fleet: DriverWithState[];
  allOrders: ActiveOrder[];
};

const mapName = (d: any) =>
  `${[d.first_name, d.last_name].filter(Boolean).join(' ')}`.trim() || 
  d.email || 
  d.phone || 
  `Livreur ${d.id?.slice(0, 8) || '?'}`;

const formatDelay = (hours: number): string => {
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return `${days}j ${remainingHours}h`;
};

export default function AlertsPanel({ fleet, allOrders }: Props) {
  const [showAll, setShowAll] = useState(false);
  
  const alertsByDriver = useMemo(() => {
    const grouped = new Map<string, {
      driver: any;
      overloaded: boolean;
      lateCount: number;
      maxDelayHours: number;
      immobile: boolean;
      immobileMinutes: number;
    }>();
    
    const now = Date.now();
    
    fleet.forEach(f => {
      if (f.isOverloaded || f.delayedOrdersCount > 0 || (f.orders.length > 0 && f.lastSeenMinutes != null && f.lastSeenMinutes > 15)) {
        const lateOrders = f.orders.filter(o => {
          if (['delivered', 'cancelled'].includes(o.status || '')) return false;
          const diff = (now - new Date(o.created_at).getTime()) / 1000 / 60 / 60;
          return diff > 2;
        });
        
        const maxDelay = lateOrders.length > 0
          ? Math.max(...lateOrders.map(o => (now - new Date(o.created_at).getTime()) / 1000 / 60 / 60))
          : 0;
        
        grouped.set(f.driver.id, {
          driver: f.driver,
          overloaded: f.isOverloaded,
          lateCount: lateOrders.length,
          maxDelayHours: maxDelay,
          immobile: f.orders.length > 0 && f.lastSeenMinutes != null && f.lastSeenMinutes > 15,
          immobileMinutes: f.lastSeenMinutes || 0,
        });
      }
    });
    
    return Array.from(grouped.values())
      .sort((a, b) => b.maxDelayHours - a.maxDelayHours)
      .slice(0, showAll ? undefined : 5);
  }, [fleet, allOrders, showAll]);

  const totalAlerts = useMemo(() => {
    return fleet.filter(f => 
      f.isOverloaded || 
      f.delayedOrdersCount > 0 || 
      (f.orders.length > 0 && f.lastSeenMinutes != null && f.lastSeenMinutes > 15)
    ).length;
  }, [fleet]);

  if (totalAlerts === 0) return null;

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="small">
      {alertsByDriver.map((alert) => {
        const tags = [];
        if (alert.overloaded) tags.push(<Tag key="overload" color="red">Surchargé ({fleet.find(f => f.driver.id === alert.driver.id)?.orders.length} liv.)</Tag>);
        if (alert.lateCount > 0) tags.push(<Tag key="late" color="orange">{alert.lateCount} en retard ({formatDelay(alert.maxDelayHours)})</Tag>);
        if (alert.immobile) tags.push(<Tag key="immobile" color="volcano">Immobile {alert.immobileMinutes}min</Tag>);
        
        return (
          <Alert
            key={alert.driver.id}
            type={alert.overloaded ? 'error' : 'warning'}
            title={
              <Space>
                <span>{mapName(alert.driver)}</span>
                {tags}
              </Space>
            }
            showIcon
            style={{ 
              borderRadius: '12px',
              fontWeight: 600,
            }}
          />
        );
      })}
      
      {totalAlerts > 5 && !showAll && (
        <Button 
          type="link" 
          size="small" 
          onClick={() => setShowAll(true)}
          className="w-full"
        >
          Voir {totalAlerts - 5} alerte(s) de plus
        </Button>
      )}
      
      {showAll && totalAlerts > 5 && (
        <Button 
          type="link" 
          size="small" 
          onClick={() => setShowAll(false)}
          className="w-full"
        >
          Afficher moins
        </Button>
      )}
    </Space>
  );
}
