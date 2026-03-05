'use client';

import React, { useEffect, useState } from 'react';
import { App, Layout } from 'antd';
import ThemeProvider from '@/components/layout/ThemeProvider';
import AdminSidebar from '@/components/layout/AdminSidebar';
import AdminHeader from '@/components/layout/AdminHeader';
import ToastBridge from '@/components/ui/ToastBridge';

const { Content } = Layout;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('gba-sider-collapsed') === 'true');
    } catch {}
  }, []);

  const handleCollapse = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem('gba-sider-collapsed', String(v));
    } catch {}
  };

  return (
    <ThemeProvider>
      <App>
        <ToastBridge />
        <Layout style={{ minHeight: '100vh' }}>
          <AdminSidebar collapsed={collapsed} onCollapse={handleCollapse} />
          <Layout>
            <AdminHeader collapsed={collapsed} onToggleCollapse={() => handleCollapse(!collapsed)} />
            <Content className="admin-content">
              {children}
            </Content>
          </Layout>
        </Layout>
      </App>
    </ThemeProvider>
  );
}
