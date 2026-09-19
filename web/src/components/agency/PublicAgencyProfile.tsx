import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, MapPin, MessageSquare, Phone, Star } from 'lucide-react'
import { api } from '@/api/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { PropertyCard } from '@/components/PropertyCard'

export function PublicAgencyProfile({ agency }: { agency: any }) {
  const profile = agency.profile_settings || {}
  const brandColor = agency.brand_primary_color || agency.primary_color || 'var(--lc-action-primary)'
  const brandFont = agency.brand_font_family === 'archivo' ? 'var(--lc-font-display)' : 'var(--lc-font-ui)'
  const [contact, setContact] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [contactStatus, setContactStatus] = useState('')

  const submitContact = async (event: React.FormEvent) => {
    event.preventDefault()
    setSending(true)
    setContactStatus('')
    try {
      await api.createInquiry({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        message: contact.message,
        agency_id: agency.id,
        property_title: `Agency inquiry: ${agency.name}`,
        source: 'public_agency_profile',
        channel: 'web',
      })
      setContact({ name: '', email: '', phone: '', message: '' })
      setContactStatus('Message sent. The agency can now follow up with you.')
    } catch (error) {
      setContactStatus(error instanceof Error ? error.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--lc-bg-page)]" dir="auto" style={{ fontFamily: brandFont }}>
      <header className="border-b bg-[var(--lc-surface-raised)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link to="/agents" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            Back to agents
          </Link>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-primary-faint p-4">
              {agency.logo_url || agency.logo ? (
                <img src={agency.logo_url || agency.logo} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <Building2 className="h-12 w-12" style={{ color: brandColor }} aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]" style={{ color: brandColor }}>
                {profile.hero_title || agency.name}
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {profile.hero_body || agency.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {agency.license_number && <Badge variant="outline">License {agency.license_number}</Badge>}
                {agency.phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-4 w-4" aria-hidden="true" />{agency.phone}</span>}
                {agency.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4" aria-hidden="true" />{agency.email}</span>}
                {agency.address && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" />{agency.address}</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {profile.show_team !== false && (
          <section aria-labelledby="agency-team-heading">
            <h2 id="agency-team-heading" className="mb-4 text-xl font-bold">
              Our team (<Numeric>{agency.members?.length || 0}</Numeric>)
            </h2>
            {agency.members?.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {agency.members.map((member: any) => (
                  <Link key={member.id} to={`/agent/${member.user_id}`}>
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="flex items-center gap-4 p-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.user?.photo} />
                          <AvatarFallback>{member.user?.name?.split(' ').map((name: string) => name[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.user?.name}</p>
                          <p className="text-xs capitalize text-muted-foreground">{member.role}</p>
                          {member.user?.rating && (
                            <div className="mt-1 flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                              <Numeric className="text-xs">{member.user.rating}</Numeric>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Team profiles will appear here when published.</p>
            )}
          </section>
        )}

        {profile.show_listings !== false && (
          <section aria-labelledby="agency-listings-heading">
            <h2 id="agency-listings-heading" className="mb-4 text-xl font-bold">
              Listings (<Numeric>{agency.listings?.length || 0}</Numeric>)
            </h2>
            {agency.listings?.length ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {agency.listings.map((property: any) => <PropertyCard key={property.id} property={property} />)}
              </div>
            ) : (
              <p className="text-muted-foreground">No active listings from this agency.</p>
            )}
          </section>
        )}

        {profile.show_reviews !== false && (
          <section aria-labelledby="agency-reviews-heading">
            <h2 id="agency-reviews-heading" className="mb-4 text-xl font-bold">Client reviews</h2>
            {agency.reviews?.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agency.reviews.map((review: any) => (
                  <Card key={review.id}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                        <Numeric className="font-semibold">{review.rating}</Numeric>
                        <span className="sr-only">out of five</span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{review.comment}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No published reviews yet.</p>
            )}
          </section>
        )}

        {profile.show_closed_transactions && (
          <section aria-labelledby="agency-closed-heading">
            <h2 id="agency-closed-heading" className="mb-4 text-xl font-bold">Closed transactions</h2>
            {agency.closed_transactions?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {agency.closed_transactions.map((transaction: any) => (
                  <Card key={transaction.id}>
                    <CardContent className="p-4">
                      <Badge variant="secondary">◆ Closed</Badge>
                      <p className="mt-3 font-medium capitalize">{String(transaction.type || 'Property').replace(/_/g, ' ')}</p>
                      <Numeric className="mt-1 block text-xs text-muted-foreground">
                        {transaction.closed_at ? new Date(transaction.closed_at).toLocaleDateString() : 'Date unavailable'}
                      </Numeric>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No public transaction activity yet.</p>
            )}
          </section>
        )}

        {profile.show_contact_form !== false && (
          <section aria-labelledby="agency-contact-heading">
            <Card>
              <CardHeader>
                <CardTitle id="agency-contact-heading" className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  Contact {agency.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitContact} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="agency-contact-name">Name</Label><Input id="agency-contact-name" value={contact.name} required onChange={(event) => setContact({ ...contact, name: event.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="agency-contact-email">Email</Label><Input id="agency-contact-email" type="email" value={contact.email} required onChange={(event) => setContact({ ...contact, email: event.target.value })} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label htmlFor="agency-contact-phone">Phone</Label><Input id="agency-contact-phone" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="agency-contact-message">How can the agency help?</Label>
                    <textarea id="agency-contact-message" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={4} minLength={10} required value={contact.message} onChange={(event) => setContact({ ...contact, message: event.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground" role="status">{contactStatus}</p>
                    <Button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send inquiry'}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  )
}
