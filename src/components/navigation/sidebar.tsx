'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wheat,
  BookOpenText,
  Calculator,
  Settings,
  CakeSlice,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

      {/* Footer Info */}
      <div className="border-t border-[#EFE4E6] pt-4 flex flex-col space-y-2">
        <div className="flex items-center justify-between px-2 text-xs text-[#7C6970]">
          <div className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-[#C86D7F] fill-[#C86D7F]" />
            <span className="font-medium text-[#4A2832]">Ateliê Conectado</span>
          </div>
          <span className="text-[10px] bg-[#FDF0F3] text-[#8A3E50] px-2 py-0.5 rounded-full font-medium">
            Supabase
          </span>
        </div>
      </div>
    </aside>
  );
}
