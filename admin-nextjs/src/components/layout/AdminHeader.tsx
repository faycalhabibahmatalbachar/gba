'use client';

import React, { useMemo } from 'react';
import { Breadcrumb, Button, Dropdown, Layout, Space } from 'antd';
import type { MenuProps } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, MoonOutlined, SunOutlined, UserOutlined } from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/components/layout/ThemeProvider';

const { Header } = Layout;

type Props = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function buildBreadcrumb(pathname: string | null): { title: string; href?: string }[] {
  if (!pathname) return [{ title: 'Tableau de bord' }];
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ title: 'Tableau de bord' }];

  const map: Record<string, string> = {
    dashboard: 'Tableau de bord',
    orders: 'Commandes',
    monitoring: 'Surveillance',
    products: 'Produits',
    categories: 'Catégories',
    tags: 'Étiquettes',
    deliveries: 'Livraisons',
    'delivery-tracking': 'Suivi livraisons',
    drivers: 'Livreurs',
    users: 'Utilisateurs',
    messages: 'Messages',
    banners: 'Bannières',
    settings: 'Paramètres',
  };

  const crumbs: { title: string; href?: string }[] = [];
  let current = '';
  for (const p of parts) {
    current += `/${p}`;
    crumbs.push({ title: map[p] || p, href: current });
  }
  return crumbs;
}

export default function AdminHeader({ collapsed, onToggleCollapse }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { dark, toggle, ready } = useThemeMode();

  const breadcrumb = useMemo(() => buildBreadcrumb(pathname), [pathname]);

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: user?.email || 'Compte',
      icon: <UserOutlined />,
      onClick: () => router.push('/settings'),
    },
    {
      key: 'logout',
      label: 'Déconnexion',
      onClick: () => void signOut(),
    },
  ];

  return (
    <Header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 h-14 flex items-center justify-between">
      <Space size={12} className="min-w-0">
        <Button
          type="text"
          onClick={onToggleCollapse}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        />
        <Breadcrumb
          items={breadcrumb.map((c) => ({ title: c.title }))}
        />
      </Space>

      <Space size={8}>
        <Button
          type="text"
          onClick={toggle}
          icon={!ready ? <MoonOutlined /> : (dark ? <SunOutlined /> : <MoonOutlined />)}
          title={!ready ? 'Thème' : (dark ? 'Mode clair' : 'Mode sombre')}
        />
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button type="default" size="small" icon={<UserOutlined />}
            className="max-w-[220px] overflow-hidden">
            <span className="hidden sm:inline truncate">{user?.email || 'Admin'}</span>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
}
