import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full cursor-pointer appearance-none rounded-lg border border-input',
          'bg-background bg-[length:1.1rem] bg-[right_0.65rem_center] bg-no-repeat px-3.5 py-2 pr-10',
          'text-sm text-foreground shadow-sm transition-all duration-150',
          'focus-visible:border-primary focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:shadow-brand',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.6' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
        }}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export { Select };