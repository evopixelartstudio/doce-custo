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
      <header className="no-print md:hidden flex items-center justify-between px-4 py-3.5 border-b border-[#E7E2D8] bg-[#FAF8F5]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#6D8576] flex items-center justify-center text-white shadow-sm">
            <CakeSlice className="h-4 w-4" />
          </div>
          <span className="font-semibold text-base text-[#35483E]">
            DoceCusto
          </span>
        </div>
      </header>

      {/* Bottom Thumb Navigation Bar */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[#E7E2D8] bg-[#FAF8F5]/95 backdrop-blur-md px-3 py-1.5 flex items-center justify-around pb-safe">
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
                'flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all',
                isActive
                  ? 'text-[#35483E] font-semibold'
                  : 'text-[#6D7A72] hover:text-[#35483E]'
              )}
            >
              <div
                className={cn(
                  'p-1 rounded-lg transition-colors',
                  isActive ? 'bg-[#E3EDE6] text-[#35483E]' : ''
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
