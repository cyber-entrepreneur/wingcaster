import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type NumericTag = 'span' | 'p' | 'div' | 'dd' | 'td' | 'strong'

interface NumericProps extends HTMLAttributes<HTMLElement> {
  as?: NumericTag
  children: ReactNode
}

export function Numeric({ as: Comp = 'span', className, children, ...props }: NumericProps) {
  return (
    <Comp data-lc-numeric className={cn('lc-data', className)} {...props}>
      {children}
    </Comp>
  )
}
