import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'brand'
    | 'brand-outline';
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'icon';
}

const variantClasses = {
  default:
    'bg-primary text-primary-foreground shadow-brand hover:bg-apes-red-dark active:bg-apes-red-darker',
  brand:
    'bg-brand-gradient text-white shadow-brand hover:brightness-95 active:brightness-90',
  'brand-outline':
    'border-2 border-primary bg-transparent text-primary hover:bg-accent',
  destructive:
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
  outline:
    'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizeClasses = {
  xs: 'h-8 rounded-md px-2.5 text-xs',
  sm: 'h-9 rounded-md px-3.5 text-sm',
  default: 'h-10 rounded-lg px-4 text-sm',
  lg: 'h-11 rounded-lg px-6 text-sm',
  xl: 'h-12 rounded-lg px-8 text-base',
  icon: 'h-10 w-10',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'default', size = 'default', type = 'button', ...props },
    ref
  ) => {
    return (
      <button
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
          'ring-offset-background transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };