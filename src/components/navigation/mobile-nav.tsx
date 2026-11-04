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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  {
    name: 'Início',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Ingredientes',
    href: '/ingredientes',
    icon: Wheat,
  },
  {
    name: 'Receitas',
    href: '/receitas',
    icon: BookOpenText,
  },
  {
    name: 'Simulador',
    href: '/simulador',
    icon: Calculator,
  },
  {
    name: 'Ajustes',
    href: '/configuracoes',
    icon: Settings,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Top Mobile Bar */}
      <header className="no-print md:hidden flex items-center justify-between px-4 py-3.5 border-b border-[#EFE4E6] bg-[#FDFBF9]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#D97E90] to-[#C86D7F] flex items-center justify-center text-white shadow-sm">
            <CakeSlice className="h-4 w-4" />
          </div>
          <span className="font-semibold text-base text-[#4A2832]">
            DoceCusto
          </span>
        </div>
      </header>

      {/* Bottom Thumb Navigation Bar */}
      <nav
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#EFE4E6] bg-[#FDFBF9]/95 backdrop-blur-md px-2 pt-2 flex items-center justify-around shadow-lg shadow-black/5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
      >
        {mobileNavItems.map((item) => {
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
                'flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all min-w-[56px] min-h-[48px] active:scale-95',
                isActive
                  ? 'text-[#C86D7F] font-bold'
                  : 'text-[#7C6970] hover:text-[#4A2832]'
              )}
            >
              <div
                className={cn(
                  'p-1.5 rounded-xl transition-all',
                  isActive ? 'bg-[#FDF0F3] text-[#C86D7F] scale-110 shadow-sm' : 'text-[#7C6970]'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
