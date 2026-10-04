import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[84px] w-full rounded-lg border border-input bg-background px-3.5 py-2.5',
          'text-sm text-foreground placeholder:text-muted-foreground/70 shadow-sm',
          'transition-all duration-150',
          'focus-visible:border-primary focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:shadow-brand',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };