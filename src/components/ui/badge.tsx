import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-[#F7D8DF] bg-[#FDF0F3] text-[#8A3E50]',
        secondary:
          'border-[#EFE4E6] bg-[#F8EEF0] text-[#6E4F57]',
        success:
          'border-[#C9E7D8] bg-[#EEF8F3] text-[#2D6A4F]',
        warning:
          'border-[#FCE3CB] bg-[#FFF6EE] text-[#A6601A]',
        destructive:
          'border-[#F8D2D5] bg-[#FDF2F3] text-[#A82B35]',
        outline:
          'text-[#5E4850] border-[#EFE4E6]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
