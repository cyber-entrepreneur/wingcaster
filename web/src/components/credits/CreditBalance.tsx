import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CreditBalanceProps {
  balance: number
  reserved?: number
  threshold?: number
  hardBlock?: boolean
}

export function CreditBalance({ balance, reserved = 0, threshold = 1, hardBlock }: CreditBalanceProps) {
  const available = balance - reserved
  const blocked = hardBlock ?? available <= 0
  const low = !blocked && available < threshold
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Credit balance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${blocked ? 'text-destructive' : low ? 'text-amber-600' : ''}`}>
            {available.toFixed(2)}
          </span>
          <span className="text-muted-foreground">credits available</span>
        </div>
        {reserved > 0 && <p className="text-sm text-muted-foreground">{reserved.toFixed(2)} reserved</p>}
        {blocked && (
          <p className="mt-2 text-sm text-destructive">
            Hard block: shared credit balance is zero. Features that spend credits cannot run until you top up.
          </p>
        )}
        {low && (
          <p className="mt-2 text-sm text-amber-700">Credit balance is low. Top up soon.</p>
        )}
      </CardContent>
    </Card>
  )
}
