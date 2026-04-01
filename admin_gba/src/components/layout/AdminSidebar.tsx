'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, MapPin,
  Car, Users, MessageSquare, Activity, Image, Settings,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
};

const NAV: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Commandes', href: '/orders', icon: ShoppingCart },
  {
    label: 'Produits', icon: Package,
    children: [
      { label: 'Tous les produits', href: '/products' },
      { label: 'Catégories', href: '/products/categories' },
    ],
  },
  {
    label: 'Livraisons', icon: Truck,
    children: [
      { label: 'Toutes les livraisons', href: '/deliveries' },
      { label: 'Suivi en direct', href: '/deliveries/tracking' },
    ],
  },
  { label: 'Livreurs', href: '/drivers', icon: Car },
  { label: 'Utilisateurs', href: '/users', icon: Users },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Surveillance', href: '/monitoring', icon: Activity },
  { label: 'Bannières', href: '/banners', icon: Image },
  { label: 'Paramètres', href: '/settings', icon: Settings },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Produits: pathname.startsWith('/products'),
    Livraisons: pathname.startsWith('/deliveries'),
  });

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  function toggleExpand(label: string) {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <TooltipProvider delay={300}>
      <aside
        className={cn(
          'flex flex-col h-full border-r border-border bg-sidebar transition-all duration-300 shrink-0',
          collapsed ? 'w-[60px]' : 'w-[240px]',
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 px-3 h-14 border-b border-border shrink-0', collapsed && 'justify-center px-0')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/30">
            <span className="text-sm font-black text-primary-foreground">G</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-sidebar-foreground leading-tight truncate">GBA Admin</div>
              <div className="text-[10px] text-muted-foreground truncate">Panneau de gestion</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-0.5 px-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isOpen = expanded[item.label];

              if (item.children) {
                const anyActive = item.children.some(c => isActive(c.href));
                return (
                  <div key={item.label}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              className={cn(
                                'flex h-9 w-full items-center justify-center rounded-md transition-colors',
                                anyActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                              )}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </button>
                          }
                        />
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleExpand(item.label)}
                          className={cn(
                            'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                            anyActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                          )}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3">
                            {item.children.map(child => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  'flex h-8 items-center rounded-md px-2 text-[13px] transition-colors',
                                  isActive(child.href)
                                    ? 'text-primary font-medium'
                                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                                )}
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              }

              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={item.href!}
                        className={cn(
                          'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive(item.href!)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    }
                  />
                  {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className={cn('flex items-center border-t border-border p-2', collapsed ? 'justify-center' : 'justify-end')}>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 text-muted-foreground">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
