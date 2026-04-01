'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout, Menu, Tooltip } from 'antd';
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
      { type: 'divider', key: 'd1' },
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
      { type: 'divider', key: 'd2' },
      {
        key: 'products',
        icon: <DeploymentUnitOutlined />,
        label: 'Produits',
        children: [
          { key: 'products-all',        icon: <DeploymentUnitOutlined />, label: <Link href="/products">Tous les produits</Link>         },
          { key: 'products-categories', icon: <TagsOutlined />,           label: <Link href="/products/categories">Catégories</Link> },
        ],
      },
      { type: 'divider', key: 'd3' },
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
        icon: <CarOutlined />,
        label: <Link href="/drivers">Livreurs</Link>,
      },
      { type: 'divider', key: 'd4' },
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
      { type: 'divider', key: 'd5' },
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
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4"
        style={{ height: 60, borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg"
          style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fontFamily: 'var(--font-heading)' }}
        >
          G
        </div>
        {!collapsed && (
          <div className="leading-tight animate-fade-in">
            <div className="font-semibold" style={{ fontSize: 15, color: 'var(--sidebar-text)', fontFamily: 'var(--font-heading)' }}>
              GBA Admin
            </div>
            <div style={{ fontSize: 11, color: 'var(--sidebar-text-muted)' }}>
              Panneau de gestion
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <Menu
        theme="dark"
        mode="inline"
        items={items}
        selectedKeys={selectedKeys}
        openKeys={collapsed ? [] : openKeys}
        onOpenChange={(keys) => setOpenKeys(keys as string[])}
        style={{ borderInlineEnd: 'none', padding: '8px 0' }}
      />

      {/* Footer — user section */}
      {!collapsed && (
        <div
          className="absolute bottom-0 left-0 right-0 animate-fade-in"
          style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--sidebar-border)' }}
        >
          <div
            className="flex items-center gap-3 rounded-lg cursor-pointer"
            style={{ padding: '10px 12px', transition: 'background 150ms ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div className="relative flex-shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              >
                AD
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse-dot"
                style={{ background: '#10B981', border: '2px solid var(--sidebar-bg)' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>
                Admin
              </div>
              <div className="truncate" style={{ fontSize: 11, color: '#10B981' }}>
                En ligne
              </div>
            </div>
          </div>
        </div>
      )}
    </Sider>
  );
}
