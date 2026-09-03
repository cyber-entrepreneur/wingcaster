import { CreditBalance as SharedCreditBalance } from '@/components/credits/CreditBalance'

export function CreditBalance(props: {
  balance: number
  reserved?: number
  threshold?: number
}) {
  return <SharedCreditBalance {...props} />
}
