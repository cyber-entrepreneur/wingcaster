import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow] duration-fast ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-tap',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]',
        destructive:
          'bg-[var(--lc-status-unpublished-fg)] text-[var(--lc-text-inverse)] hover:bg-[var(--lc-status-unpublished-dot)]',
        outline:
          'border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] text-[var(--lc-text-primary)] hover:bg-[var(--lc-action-secondary)] hover:text-[var(--lc-action-secondary-text)]',
        secondary:
          'bg-[var(--lc-action-secondary)] text-[var(--lc-action-secondary-text)] hover:bg-[var(--lc-surface-sunken)]',
        ghost:
          'text-[var(--lc-text-primary)] hover:bg-[var(--lc-action-secondary)] hover:text-[var(--lc-action-secondary-text)]',
        link: 'text-[var(--lc-text-brand)] underline-offset-4 hover:text-[var(--lc-action-primary-hover)] hover:underline',
      },
      size: {
        default: 'min-h-tap px-4 py-2',
        sm: 'min-h-tap rounded-md px-3',
        lg: 'min-h-tap rounded-md px-8',
        icon: 'h-tap w-tap min-h-tap min-w-tap',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
