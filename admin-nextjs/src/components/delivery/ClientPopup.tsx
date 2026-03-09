import React from 'react';
import { Card, Avatar, Space, Divider, Tag } from 'antd';
import { EnvironmentOutlined, ShoppingOutlined } from '@ant-design/icons';

type Props = {
  location: any;
  order: any;
};

export function ClientPopup({ location, order }: Props) {
  const accuracy = location?.accuracy || 0;
  
  return (
    <Card 
      size="small" 
      className="min-w-[280px]"
      styles={{ body: { padding: 12 } }}
      variant="borderless"
    >
      <Space orientation="vertical" size="small" className="w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Avatar 
            size={40} 
            style={{ backgroundColor: '#1890ff', fontSize: 18 }}
          >
            👤
          </Avatar>
          <div className="flex-1">
            <div className="font-bold">{order?.displayName || 'Client'}</div>
            <Tag color="blue" icon={<ShoppingOutlined />}>
              {order?.displayNum || 'Commande'}
            </Tag>
          </div>
        </div>
        
        <Divider className="my-2" />
        
        {/* Informations GPS */}
        <Space orientation="vertical" size={4} className="w-full">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Précision GPS</span>
            <Tag color={accuracy < 20 ? 'green' : accuracy < 100 ? 'orange' : 'red'}>
              ±{accuracy.toFixed(0)}m
            </Tag>
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Position</span>
            <span className="font-mono text-gray-700 dark:text-gray-300 text-[10px]">
              {location?.latitude?.toFixed(5)}, {location?.longitude?.toFixed(5)}
            </span>
          </div>
          
          {location?.captured_at && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Dernière position</span>
              <span className="text-gray-700 dark:text-gray-300">
                {new Date(location.captured_at).toLocaleTimeString('fr-FR')}
              </span>
            </div>
          )}
        </Space>
        
        {/* Statut commande */}
        {order?.status && (
          <>
            <Divider className="my-2" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Statut</span>
              <Tag color={
                order.status === 'delivered' ? 'green' :
                order.status === 'shipped' ? 'blue' :
                order.status === 'processing' ? 'orange' : 'default'
              }>
                {order.status}
              </Tag>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
}
