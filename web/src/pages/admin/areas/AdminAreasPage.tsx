import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AdminArea } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'

export function AdminAreasPage() {
  const { isAdmin } = useAuth()
  const [areas, setAreas] = useState<AdminArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    loadAreas()
  }, [isAdmin])

  async function loadAreas() {
    setLoading(true)
    try {
      const data = await api.listAdminAreas({ limit: '200' })
      setAreas((data as { items?: AdminArea[] }).items || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load areas')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="container py-8 text-sm text-red-500">Platform admin access required.</div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Area Intelligence Admin</h1>
        <Button asChild>
          <Link to="/admin/areas/new">Create area</Link>
        </Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      <p className="mb-4 text-xs text-muted-foreground">
        Open an area to edit its boundary, disclosure copy, sources, and scoring operations.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {areas.map((area) => (
              <Link
                key={area.id}
                to={`/admin/areas/${area.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{area.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {area.level} · {area.slug}
                  </div>
                </div>
                <Badge variant={area.status === 'scoring_enabled' ? 'default' : 'secondary'}>
                  {area.status}
                </Badge>
              </Link>
            ))}
            {!loading && areas.length === 0 && (
              <p className="text-sm text-muted-foreground">No areas found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
