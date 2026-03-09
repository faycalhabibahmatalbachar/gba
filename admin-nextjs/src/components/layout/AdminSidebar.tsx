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
      <div className="h-14 px-4 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
          G
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-white font-semibold">GBA Admin</div>
            <div className="text-xs text-white/60">Panneau de gestion</div>
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
        style={{ borderInlineEnd: 'none' }}
      />
    </Sider>
  );
}
