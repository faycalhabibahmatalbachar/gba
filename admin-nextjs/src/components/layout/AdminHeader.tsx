'use client';

import React, { useMemo } from 'react';
import { Button, Dropdown, Layout, Space } from 'antd';
import type { MenuProps } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, MoonOutlined, SunOutlined, UserOutlined, DownOutlined, LogoutOutlined } from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/components/layout/ThemeProvider';

const { Header } = Layout;

type Props = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

const ROUTE_LABELS: Record<string, string> = {
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

function buildBreadcrumb(pathname: string | null): { title: string; href?: string }[] {
  if (!pathname) return [{ title: 'Tableau de bord' }];
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ title: 'Tableau de bord' }];
  const crumbs: { title: string; href?: string }[] = [];
  let current = '';
  for (const p of parts) {
    current += `/${p}`;
    crumbs.push({ title: ROUTE_LABELS[p] || p, href: current });
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
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Déconnexion',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => void signOut(),
    },
  ];

  return (
    <Header
      className="flex items-center justify-between animate-fade-in"
      style={{
        height: 60,
        lineHeight: '60px',
        padding: '0 20px',
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--header-border)',
      }}
    >
      {/* Left: toggle + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          type="text"
          onClick={onToggleCollapse}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          style={{ width: 36, height: 36, color: 'var(--text-2)', borderRadius: 8 }}
        />

        <div className="hidden md:flex items-center gap-1.5">
          {breadcrumb.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>/</span>
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                  color: i === breadcrumb.length - 1 ? 'var(--text-1)' : 'var(--text-2)',
                  fontFamily: i === breadcrumb.length - 1 ? 'var(--font-heading)' : 'var(--font-body)',
                }}
              >
                {c.title}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: theme toggle + user */}
      <Space size={8}>
        <Button
          type="text"
          onClick={toggle}
          icon={!ready ? <MoonOutlined /> : (dark ? <SunOutlined /> : <MoonOutlined />)}
          title={!ready ? 'Thème' : (dark ? 'Mode clair' : 'Mode sombre')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            color: 'var(--text-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />

        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <button
            className="flex items-center gap-2 cursor-pointer"
            style={{
              height: 36,
              padding: '0 10px 0 6px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              transition: 'all 150ms ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
            >
              {user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <span
              className="hidden sm:inline truncate"
              style={{
                maxWidth: 120,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-1)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {user?.email?.split('@')[0] || 'Admin'}
            </span>
            <DownOutlined style={{ fontSize: 10, color: 'var(--text-3)' }} />
          </button>
        </Dropdown>
      </Space>
    </Header>
  );
}
