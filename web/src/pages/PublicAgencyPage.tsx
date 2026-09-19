import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicAgencyProfile } from '@/components/agency/PublicAgencyProfile'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { api } from '@/api/client'

export function PublicAgencyPage() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const [agency, setAgency] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  usePageTitle(agency?.name || 'Agency')

  useEffect(() => {
    const description = agency?.profile_settings?.meta_description
    if (!description) return
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previous = meta?.content
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = description
    return () => {
      if (previous && meta) meta.content = previous
    }
  }, [agency?.profile_settings?.meta_description])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.getPublicAgency(id)
      .then(data => { setAgency(data); setLoading(false) })
      .catch((err: any) => {
      addToast({ title: 'Failed to load agency', description: err.message || 'Could not load agency', variant: 'error' })
      setLoading(false)
    })
  }, [id, addToast])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!agency) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Agency not found</h2>
          <Link to="/agents"><Button className="mt-4">Browse Agents</Button></Link>
        </div>
      </div>
    )
  }

  return <PublicAgencyProfile agency={agency} />
}
