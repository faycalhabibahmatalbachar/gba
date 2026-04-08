'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, MapPin,
  Car, Users, MessageSquare, Mail, Activity, Image, Settings,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Bell, BarChart3, Shield, FileSpreadsheet, Star, Warehouse, FileText, ClipboardList,
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
    ],
  },
  {
    label: 'Livreurs',
    icon: Car,
    children: [
      { label: 'Liste & carte', href: '/drivers' },
      { label: 'Carte live', href: '/drivers/live' },
    ],
  },
  { label: 'Utilisateurs', href: '/users', icon: Users },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Avis', href: '/reviews', icon: Star },
  { label: 'Inventaire', href: '/inventory', icon: Warehouse },
  { label: 'CMS', href: '/cms', icon: FileText },
  { label: 'Rapports', href: '/reports', icon: FileSpreadsheet },
  { label: 'Audit', href: '/audit', icon: ClipboardList },
  { label: 'Sécurité', href: '/security', icon: Shield },
  { label: 'Surveillance', href: '/monitoring', icon: Activity },
  { label: 'Bannières', href: '/banners', icon: Image },
  { label: 'Journal emails', href: '/email-logs', icon: Mail },
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
    Livreurs: pathname.startsWith('/drivers'),
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
          'relative flex flex-col h-full min-h-0 border-r border-[var(--gba-sidebar-border)] bg-[var(--gba-sidebar-bg)] transition-all duration-300 shrink-0 text-[var(--gba-sidebar-fg)]',
          collapsed ? 'w-[60px]' : 'w-[240px]',
        )}
      >
        {/* Logo 32px — marque GBA */}
        <div className={cn('flex items-center gap-3 px-3 h-14 border-b border-[var(--gba-sidebar-border)] shrink-0', collapsed && 'justify-center px-0')}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-lg"
            style={{ background: 'var(--gba-brand)', boxShadow: '0 8px 24px color-mix(in srgb, var(--gba-brand) 35%, transparent)' }}
          >
            <span className="text-sm font-black text-white">G</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight truncate">GBA Admin</div>
              <div className="text-[10px] text-[var(--gba-sidebar-muted)] truncate">Panneau de gestion</div>
            </div>
          )}
        </div>

        {/* Nav — scrollable (menu long) */}
        <ScrollArea className="flex-1 min-h-0 py-2">
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
                                  ? 'bg-[var(--gba-brand-muted)] text-white'
                                  : 'text-[var(--gba-sidebar-muted)] hover:bg-white/5 hover:text-[var(--gba-sidebar-fg)]',
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
                              ? 'bg-[var(--gba-brand-muted)] text-white font-medium'
                              : 'text-[var(--gba-sidebar-muted)] hover:bg-white/5 hover:text-[var(--gba-sidebar-fg)]',
                          )}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                            {item.children.map(child => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  'flex h-8 items-center rounded-md px-2 text-[13px] transition-colors',
                                  isActive(child.href)
                                    ? 'text-[var(--gba-brand)] font-medium'
                                    : 'text-[var(--gba-sidebar-muted)] hover:text-[var(--gba-sidebar-fg)] hover:bg-white/5',
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
                            ? 'bg-[var(--gba-brand-muted)] text-white font-medium'
                            : 'text-[var(--gba-sidebar-muted)] hover:bg-white/5 hover:text-[var(--gba-sidebar-fg)]',
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

        {/* Réduire / étendre — au milieu du bord droit */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onToggle}
          className={cn(
            'absolute right-0 top-1/2 z-20 h-8 w-8 -translate-y-1/2 translate-x-1/2 rounded-full border border-[var(--gba-sidebar-border)] shadow-md',
            'bg-[var(--gba-sidebar-bg)] text-[var(--gba-sidebar-muted)] hover:bg-white/10 hover:text-white',
          )}
          title={collapsed ? 'Développer le menu' : 'Réduire le menu'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </aside>
    </TooltipProvider>
  );
}
