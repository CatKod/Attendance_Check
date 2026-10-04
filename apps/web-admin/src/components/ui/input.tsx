import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2',
          'text-sm text-foreground placeholder:text-muted-foreground/70',
          'shadow-sm transition-all duration-150',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:border-primary focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:shadow-brand',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
          'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/25',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };