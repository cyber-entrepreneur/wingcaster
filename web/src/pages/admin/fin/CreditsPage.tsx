import { Navigate } from 'react-router-dom'

/** PA-CRD-002 wallet detail is elsewhere; lots live at PA-CRD-003 route. */
export function CreditsPage() {
  return <Navigate to="/admin/fin/credits/lots" replace />
}
