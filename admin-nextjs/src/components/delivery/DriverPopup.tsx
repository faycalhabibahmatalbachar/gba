import React from 'react';
import { Card, Avatar, Badge, Space, Divider, Tag, Progress } from 'antd';
import { EnvironmentOutlined, DashboardOutlined, ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';

type Props = {
  driver: any;
  location: any;
  orders: any[];
  mapName: (d: any) => string;
};

export function DriverPopup({ driver, location, orders, mapName }: Props) {
  const speedKmh = (location?.speed || 0) * 3.6;
  const isMoving = speedKmh > 1;
  const accuracy = location?.accuracy || 0;
  
  return (
    <Card 
      size="small" 
      className="min-w-[300px]"
      styles={{ body: { padding: 12 } }}
      variant="borderless"
    >
      <Space orientation="vertical" size="small" className="w-full">
        {/* Header avec avatar */}
        <div className="flex items-center gap-3">
          <Avatar 
            size={48} 
            style={{ backgroundColor: '#667eea', fontSize: 20 }}
          >
            {mapName(driver).charAt(0).toUpperCase()}
          </Avatar>
          <div className="flex-1">
            <div className="font-bold text-base">{mapName(driver)}</div>
            <Space size="small">
              <Badge status="success" text="En ligne" />
              {orders.length >= 5 && <Badge status="error" text="Surchargé" />}
            </Space>
          </div>
        </div>
        
        <Divider className="my-2" />
        
        {/* Métriques principales */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Livraisons</div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{orders.length}</div>
          </div>
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Vitesse</div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {speedKmh.toFixed(1)} <span className="text-sm">km/h</span>
            </div>
          </div>
        </div>
        
        {/* Informations GPS */}
        <Space orientation="vertical" size={4} className="w-full">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Précision GPS</span>
            <Tag color={accuracy < 10 ? 'green' : accuracy < 50 ? 'orange' : 'red'}>
              ±{accuracy.toFixed(0)}m
            </Tag>
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">État</span>
            <Tag color={isMoving ? 'blue' : 'default'}>
              {isMoving ? 'En mouvement' : 'Arrêté'}
            </Tag>
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Position</span>
            <span className="font-mono text-gray-700 dark:text-gray-300 text-[10px]">
              {location?.latitude?.toFixed(5)}, {location?.longitude?.toFixed(5)}
            </span>
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Dernière mise à jour</span>
            <span className="text-gray-700 dark:text-gray-300">
              {location?.captured_at ? new Date(location.captured_at).toLocaleTimeString('fr-FR') : '—'}
            </span>
          </div>
        </Space>
        
        {/* Barre de précision */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Qualité signal GPS</div>
          <Progress 
            percent={Math.max(0, Math.min(100, 100 - accuracy))} 
            size="small"
            strokeColor={accuracy < 10 ? '#52c41a' : accuracy < 50 ? '#fa8c16' : '#f5222d'}
            showInfo={false}
          />
        </div>
      </Space>
    </Card>
  );
}
