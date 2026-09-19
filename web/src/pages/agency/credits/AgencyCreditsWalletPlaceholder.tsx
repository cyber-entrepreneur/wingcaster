import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Placeholder until AGN-CRD-001 wallet overview lands on main.
 * Keeps /agency/credits nav target usable while quotas ship first.
 */
export function AgencyCreditsWalletPlaceholder() {
  return (
    <Card data-screen="AGN-CRD-001">
      <CardHeader>
        <CardTitle>Wallet overview</CardTitle>
        <CardDescription>
          Agency-wide balance, allocation, and transactions will appear here once the wallet overview screen is merged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link to="/agency/credits/quotas">
          <Button variant="outline">View feature quotas</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
