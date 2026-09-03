import { useCallback, useEffect, useState } from 'react'
import { api, type TenantCreditNote } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

export function MyCreditNotesPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Credit notes')
  const [notes, setNotes] = useState<TenantCreditNote[]>([])

  const load = useCallback(async () => {
    try {
      const res = await api.getTenantCreditNotes()
      setNotes(res.credit_notes)
    } catch (err: any) {
      addToast({ title: 'Could not load credit notes', description: err.message, variant: 'error' })
    }
  }, [addToast])

  useEffect(() => { if (agent) load() }, [agent, load])

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Credit notes</h1>
      {notes.length === 0 ? (
        <p className="text-muted-foreground">No credit notes yet.</p>
      ) : notes.map((note) => (
        <Card key={note.id}>
          <CardHeader>
            <CardTitle className="text-lg">{note.note_number || note.id.slice(0, 8)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(note.amount_minor / 100).toFixed(2)} {note.currency} · {note.status} · {note.reason_code || '—'}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
