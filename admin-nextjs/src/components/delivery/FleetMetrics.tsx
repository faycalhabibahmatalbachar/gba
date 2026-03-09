import React, { useMemo } from 'react';
import { Card, Statistic, Row, Col, Badge, Space } from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CarOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { DriverWithState, ActiveOrder } from '@/lib/services/delivery-tracking';

type Props = {
  fleet: DriverWithState[];
  allOrders: ActiveOrder[];
};

export default function FleetMetrics({ fleet, allOrders }: Props) {
  const metrics = useMemo(() => {
    const now = Date.now();
    
    const onlineDrivers = fleet.filter(f => f.isOnline);
    const offlineDrivers = fleet.filter(f => f.isStale);
    const overloadedDrivers = fleet.filter(f => f.isOverloaded);
    
    const lateDeliveries = allOrders.filter(o => {
      if (['delivered', 'cancelled'].includes(o.status || '')) return false;
      const diff = (now - new Date(o.created_at).getTime()) / 1000 / 60 / 60;
      return diff > 2;
    });
    
    const activeDeliveries = allOrders.filter(o => 
      ['confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status || '')
    );
    
    return {
      total: fleet.length,
      online: onlineDrivers.length,
      offline: offlineDrivers.length,
      overloaded: overloadedDrivers.length,
      late: lateDeliveries.length,
      active: activeDeliveries.length,
    };
  }, [fleet, allOrders]);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={8} lg={4}>
        <Card>
          <Statistic
            title="Flotte"
            value={metrics.total}
            prefix={<TeamOutlined style={{ color: '#667eea' }} />}
            suffix="livreurs"
            styles={{ content: { color: '#667eea', fontWeight: 'bold' } }}
          />
        </Card>
      </Col>
      
      <Col xs={12} sm={8} lg={4}>
        <Card>
          <Statistic
            title="En ligne"
            value={metrics.online}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            suffix="actifs"
            styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }}
          />
        </Card>
      </Col>
      
      <Col xs={12} sm={8} lg={4}>
        <Card>
          <Statistic
            title="Hors ligne"
            value={metrics.offline}
            prefix={<WarningOutlined style={{ color: '#fa8c16' }} />}
            suffix="> 10 min"
            styles={{ content: { color: '#fa8c16', fontWeight: 'bold' } }}
          />
        </Card>
      </Col>
      
      <Col xs={12} sm={8} lg={4}>
        <Card>
          <Statistic
            title="Surchargés"
            value={metrics.overloaded}
            prefix={<CarOutlined style={{ color: '#f5222d' }} />}
            suffix="≥ 5 liv."
            styles={{ content: { color: '#f5222d', fontWeight: 'bold' } }}
          />
        </Card>
      </Col>
      
      <Col xs={12} sm={8} lg={4}>
        <Card>
          <Badge count={metrics.late} showZero={false}>
            <Statistic
              title="En retard (SLA)"
              value={metrics.late}
              prefix={<ClockCircleOutlined style={{ color: '#f5222d' }} />}
              suffix="> 2h"
              styles={{ 
                content: { 
                  color: '#f5222d', 
                  fontWeight: 'bold',
                  animation: metrics.late > 0 ? 'pulse 2s infinite' : undefined
                }
              }}
            />
          </Badge>
        </Card>
      </Col>
      
      <Col xs={12} sm={8} lg={4}>
        <Card>
          <Statistic
            title="Livraisons"
            value={metrics.active}
            prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
            suffix="en cours"
            styles={{ content: { color: '#1890ff', fontWeight: 'bold' } }}
          />
        </Card>
      </Col>
    </Row>
  );
}
