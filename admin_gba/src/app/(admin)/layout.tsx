'use client';

import { useState } from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {/* Mobile sidebar via Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[240px]">
          <AdminSidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminHeader onMenuToggle={() => setMobileSidebarOpen(true)} />
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            'p-4 md:p-6',
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
