import { cn } from '@/lib/utils'
import { TrustFooter as MfaTrustFooter } from '@/components/mfa/TrustFooter'
import { rt, type RegisterLocale } from './registerCopy'

export type TrustFooterProps = {
  locale?: RegisterLocale
  className?: string
}

/**
 * SHR-AUT-006 trust footer — Paddle + encryption + MENA compliance.
 * Reuses MFA TrustFooter styling (children prop) so we do not invent a third primitive.
 */
export function TrustFooter({ locale = 'en', className }: TrustFooterProps) {
  return (
    <div data-testid="signup-trust-footer">
      <MfaTrustFooter className={cn('text-start md:text-center', className)}>
        {rt('trust.footer', locale)}
      </MfaTrustFooter>
    </div>
  )
}
