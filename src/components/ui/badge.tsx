import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#EFF5F1] text-[#35483E] border-[#D4E3D9]',
        secondary:
          'border-transparent bg-[#F2EFEA] text-[#55635B]',
        success:
          'border-[#C7E5D3] bg-[#EAF7EE] text-[#1D6336]',
        warning:
          'border-[#F9E2C3] bg-[#FEF6EC] text-[#9A5A0A]',
        destructive:
          'border-[#F3CECB] bg-[#FCECEB] text-[#9C2822]',
        outline:
          'text-[#4A5750] border-[#E5E0D8]',
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
