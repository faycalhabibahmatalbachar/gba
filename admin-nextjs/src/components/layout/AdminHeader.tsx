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
    <Header className="flex items-center justify-between px-6 h-16 animate-fade-in" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
      {/* Left section */}
      <Space size={16} className="min-w-0 flex-1">
        <Button
          type="text"
          onClick={onToggleCollapse}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          className="hover:bg-opacity-10 transition-all duration-200"
          style={{ color: 'var(--text-primary)' }}
        />
        
        {/* Breadcrumb with modern separators */}
        <div className="hidden md:flex items-center gap-2">
          {breadcrumb.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span style={{ color: 'var(--text-muted)' }} className="text-sm">/</span>
              )}
              <span 
                className="text-sm font-medium transition-colors duration-200 hover:text-opacity-80"
                style={{ 
                  color: i === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontFamily: i === breadcrumb.length - 1 ? 'var(--font-heading)' : 'var(--font-body)'
                }}
              >
                {c.title}
              </span>
            </React.Fragment>
          ))}
        </div>
      </Space>

      {/* Right section */}
      <Space size={12}>
        {/* Theme toggle with smooth transition */}
        <Button
          type="text"
          onClick={toggle}
          icon={!ready ? <MoonOutlined /> : (dark ? <SunOutlined /> : <MoonOutlined />)}
          title={!ready ? 'Thème' : (dark ? 'Mode clair' : 'Mode sombre')}
          className="w-10 h-10 rounded-lg hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center"
          style={{ color: 'var(--text-primary)' }}
        />
        
        {/* User dropdown with avatar */}
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button 
            type="default" 
            className="h-10 px-3 rounded-lg border transition-all duration-200 hover:shadow-md flex items-center gap-2"
            style={{ 
              borderColor: 'var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
              {user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="hidden sm:inline text-sm font-medium truncate max-w-[150px]">
              {user?.email?.split('@')[0] || 'Admin'}
            </span>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
}
