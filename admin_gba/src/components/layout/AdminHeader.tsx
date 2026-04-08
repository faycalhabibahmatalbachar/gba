'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronRight, Home, LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { toast } from 'sonner';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  orders: 'Commandes',
  products: 'Produits',
  categories: 'Catégories',
  deliveries: 'Livraisons',
  drivers: 'Livreurs',
  users: 'Utilisateurs',
  messages: 'Messages',
  monitoring: 'Surveillance',
  banners: 'Bannières',
  settings: 'Paramètres',
};

interface Props {
  onMenuToggle: () => void;
}

export function AdminHeader({ onMenuToggle }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((s, i) => ({
    label: ROUTE_LABELS[s] || s,
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    toast.success('Déconnecté');
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 sticky top-0 z-30">
      {/* Mobile menu toggle */}
      <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onMenuToggle}>
        <Menu className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {breadcrumbs.map((bc) => (
          <span key={bc.href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            {bc.isLast ? (
              <span className="font-medium text-foreground truncate">{bc.label}</span>
            ) : (
              <button
                onClick={() => router.push(bc.href)}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {bc.label}
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full outline-none">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground font-bold">AD</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Administrateur</p>
                  <p className="text-xs text-muted-foreground truncate">GBA Admin</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
