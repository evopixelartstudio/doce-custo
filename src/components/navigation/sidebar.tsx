'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wheat,
  BookOpenText,
  Calculator,
  Settings,
  Sparkles,
  LogOut,
  CakeSlice,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Ingredientes',
    href: '/ingredientes',
    icon: Wheat,
  },
  {
    name: 'Receitas & Fichas',
    href: '/receitas',
    icon: BookOpenText,
  },
  {
    name: 'Simulador',
    href: '/simulador',
    icon: Calculator,
  },
  {
    name: 'Configurações',
    href: '/configuracoes',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    window.location.href = '/login';
  }

  return (
    <aside className="no-print hidden md:flex w-64 flex-col justify-between border-r border-[#EFE4E6] bg-[#FDFBF9] p-5 h-screen sticky top-0">
      <div className="flex flex-col space-y-7">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#D97E90] to-[#C86D7F] flex items-center justify-center text-white shadow-sm shadow-[#C86D7F]/30">
            <CakeSlice className="h-5 w-5" />
          </div>
          <div>
            <span className="font-semibold text-lg text-[#4A2832] tracking-tight block">
              DoceCusto
            </span>
            <span className="text-[11px] font-medium text-[#7C6970] block -mt-0.5">
              Gestão Confeitaria
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-[#C86D7F] text-white shadow-sm shadow-[#C86D7F]/25 font-semibold'
                    : 'text-[#5E4850] hover:bg-[#F8EEF0] hover:text-[#4A2832]'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 transition-transform group-hover:scale-105',
                    isActive ? 'text-white' : 'text-[#C86D7F]'
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info / Sign Out */}
      <div className="border-t border-[#EFE4E6] pt-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between px-2 text-xs text-[#7C6970]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#C86D7F]" />
            <span className="font-medium">Uso Individual</span>
          </div>
          <span className="text-[10px] bg-[#F8EEF0] text-[#6E4F57] px-2 py-0.5 rounded-full font-mono">
            v1.0
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#A82B35] hover:bg-[#FDF2F3] transition-colors w-full text-left"
        >
          <LogOut className="h-4 w-4 text-[#C44D56]" />
          <span>Sair do sistema</span>
        </button>
      </div>
    </aside>
  );
}
