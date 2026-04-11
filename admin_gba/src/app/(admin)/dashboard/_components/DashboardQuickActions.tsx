'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Package, ShoppingCart, Bell, Truck, FileBarChart, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  stockAlert?: boolean;
};

const ACTIONS = [
  { href: '/products', label: 'Créer un produit', icon: Package },
  { href: '/orders', label: 'Voir les commandes', icon: ShoppingCart },
  { href: '/notifications', label: 'Envoyer une notification', icon: Bell },
  { href: '/drivers/live', label: 'Voir les livreurs live', icon: Truck },
  { href: '/reports', label: 'Générer un rapport', icon: FileBarChart },
] as const;

export function DashboardQuickActions({ stockAlert }: Props) {
  const router = useRouter();
  const list = stockAlert
    ? [{ href: '/inventory', label: 'Stock critique', icon: AlertTriangle }, ...ACTIONS]
    : [...ACTIONS];

  return (
    <div className="flex flex-wrap gap-2">
      {list.map((a) => (
        <motion.button
          key={`${a.href}-${a.label}`}
          type="button"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.1 }}
          onClick={() => router.push(a.href)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground',
            'transition-colors hover:bg-primary/[0.05]',
          )}
        >
          <a.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          {a.label}
        </motion.button>
      ))}
    </div>
  );
}
