'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  ShoppingOutlined,
  TagsOutlined,
  DeploymentUnitOutlined,
  TeamOutlined,
  SettingOutlined,
  CarOutlined,
  MessageOutlined,
  PictureOutlined,
  RadarChartOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

type Props = {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
};

export default function AdminSidebar({ collapsed, onCollapse }: Props) {
  const pathname = usePathname();
  const [openKeys, setOpenKeys] = useState<string[]>(['products']);

  const selectedKeys = useMemo(() => {
    if (!pathname) return [];
    if (pathname.startsWith('/products/categories')) return ['products-categories'];
    if (pathname.startsWith('/products')) return ['products-all'];
    if (pathname.startsWith('/orders')) return ['orders'];
    if (pathname.startsWith('/monitoring')) return ['monitoring'];
    if (pathname.startsWith('/delivery-tracking')) return ['delivery-tracking'];
    if (pathname.startsWith('/deliveries')) return ['deliveries'];
    if (pathname.startsWith('/drivers')) return ['drivers'];
    if (pathname.startsWith('/users')) return ['users'];
    if (pathname.startsWith('/messages')) return ['messages'];
    if (pathname.startsWith('/banners')) return ['banners'];
    if (pathname.startsWith('/settings')) return ['settings'];
    return ['dashboard'];
  }, [pathname]);

  const items: MenuProps['items'] = useMemo(() => {
    return [
      {
        key: 'dashboard',
        icon: <AppstoreOutlined />,
        label: <Link href="/dashboard">Tableau de bord</Link>,
      },
      {
        key: 'orders',
        icon: <ShoppingOutlined />,
        label: <Link href="/orders">Commandes</Link>,
      },
      {
        key: 'monitoring',
        icon: <RadarChartOutlined />,
        label: <Link href="/monitoring">Surveillance</Link>,
      },
      {
        key: 'products',
        icon: <DeploymentUnitOutlined />,
        label: 'Produits',
        children: [
          { key: 'products-all',        icon: <DeploymentUnitOutlined />, label: <Link href="/products">Tous les produits</Link>         },
          { key: 'products-categories', icon: <TagsOutlined />,           label: <Link href="/products/categories">Catégories</Link> },
        ],
      },
      {
        key: 'deliveries',
        icon: <CarOutlined />,
        label: <Link href="/deliveries">Livraisons</Link>,
      },
      {
        key: 'delivery-tracking',
        icon: <EnvironmentOutlined />,
        label: <Link href="/delivery-tracking">Suivi livraisons</Link>,
      },
      {
        key: 'drivers',
        icon: <ShoppingOutlined />,
        label: <Link href="/drivers">Livreurs</Link>,
      },
      {
        key: 'users',
        icon: <TeamOutlined />,
        label: <Link href="/users">Utilisateurs</Link>,
      },
      {
        key: 'messages',
        icon: <MessageOutlined />,
        label: <Link href="/messages">Messages</Link>,
      },
      {
        key: 'banners',
        icon: <PictureOutlined />,
        label: <Link href="/banners">Bannières</Link>,
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: <Link href="/settings">Paramètres</Link>,
      },
    ];
  }, []);

  return (
    <Sider
      collapsedWidth={0}
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      width={264}
      style={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        overflow: 'auto',
      }}
    >
      <div className="h-16 px-4 flex items-center gap-3 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform duration-300 hover:scale-105 hover:rotate-3">
          G
        </div>
        {!collapsed && (
          <div className="leading-tight animate-fade-in">
            <div className="font-bold text-base" style={{ color: 'var(--sidebar-text)', fontFamily: 'var(--font-heading)' }}>GBA Admin</div>
            <div className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>Panneau de gestion</div>
          </div>
        )}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        items={items}
        selectedKeys={selectedKeys}
        openKeys={collapsed ? [] : openKeys}
        onOpenChange={(keys) => setOpenKeys(keys as string[])}
        style={{ borderInlineEnd: 'none', paddingTop: '8px', paddingBottom: '8px' }}
      />

      {/* User section at bottom */}
      {!collapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t animate-fade-in" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-white/5 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shadow-md relative">
              <span>AD</span>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2" style={{ borderColor: 'var(--sidebar-bg)' }}></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>Admin</div>
              <div className="text-xs truncate" style={{ color: 'var(--sidebar-text-muted)' }}>En ligne</div>
            </div>
          </div>
        </div>
      )}
    </Sider>
  );
}
