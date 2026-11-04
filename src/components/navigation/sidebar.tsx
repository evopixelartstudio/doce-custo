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
    <aside className="no-print hidden md:flex w-64 flex-col justify-between border-r border-[#E7E2D8] bg-[#FAF8F5] p-5 h-screen sticky top-0">
      <div className="flex flex-col space-y-7">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 rounded-2xl bg-[#6D8576] flex items-center justify-center text-white shadow-sm shadow-[#6D8576]/30">
            <CakeSlice className="h-5 w-5" />
          </div>
          <div>
            <span className="font-semibold text-lg text-[#35483E] tracking-tight block">
              DoceCusto
            </span>
            <span className="text-[11px] font-medium text-[#6E7B73] block -mt-0.5">
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
                    ? 'bg-[#6D8576] text-white shadow-sm shadow-[#6D8576]/25 font-semibold'
                    : 'text-[#47544C] hover:bg-[#EFECE5] hover:text-[#28362F]'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 transition-transform group-hover:scale-105',
                    isActive ? 'text-white' : 'text-[#6D8576]'
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info / Sign Out */}
      <div className="border-t border-[#E7E2D8] pt-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between px-2 text-xs text-[#707D75]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#6D8576]" />
            <span className="font-medium">Uso Individual</span>
          </div>
          <span className="text-[10px] bg-[#EFECE5] px-2 py-0.5 rounded-full font-mono">
            v1.0
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#7D5351] hover:bg-[#FBEBEA] transition-colors w-full text-left"
        >
          <LogOut className="h-4 w-4 text-[#C85A54]" />
          <span>Sair do sistema</span>
        </button>
      </div>
    </aside>
  );
}
