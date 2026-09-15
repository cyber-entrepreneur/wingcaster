import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleMap } from '@/components/area-intelligence/GoogleMap'
import { t, type OnboardingLocale } from '../copy'

export interface AddressFields {
  address?: string
  area_name?: string
  building_name?: string
  floor?: string
  lat?: number
  lng?: number
}

export interface AddressInlineEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: AddressFields
  locale: OnboardingLocale
  disabled?: boolean
  /** Focus a missing chip field when opening. */
  focusField?: 'area_name' | 'building_name' | 'floor' | 'address'
  onSave: (fields: AddressFields) => Promise<void>
}

const DUBAI_CENTER = { lat: 25.2048, lng: 55.2708 }

/**
 * Address editor with existing Google Maps preview (no new map dependency).
 */
export function AddressInlineEditor({
  open,
  onOpenChange,
  initial,
  locale,
  disabled,
  focusField,
  onSave,
}: AddressInlineEditorProps) {
  const [fields, setFields] = useState<AddressFields>(initial)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFields(initial)
  }, [open, initial])

  const center = {
    lat: typeof fields.lat === 'number' ? fields.lat : DUBAI_CENTER.lat,
    lng: typeof fields.lng === 'number' ? fields.lng : DUBAI_CENTER.lng,
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      const address =
        fields.address ||
        [fields.area_name, fields.building_name, fields.floor ? `Floor ${fields.floor}` : null]
          .filter(Boolean)
          .join(', ')
      await onSave({ ...fields, address })
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('review.edit.address', locale)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-[var(--lc-space-md)]">
          <GoogleMap apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} center={center} zoom={14} />
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-addr-area">{t('review.address.area', locale)}</Label>
            <Input
              id="onb-addr-area"
              className="min-h-tap"
              autoFocus={focusField === 'area_name'}
              value={fields.area_name ?? ''}
              disabled={busy || disabled}
              onChange={(e) => setFields((f) => ({ ...f, area_name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-addr-building">{t('review.address.building', locale)}</Label>
            <Input
              id="onb-addr-building"
              className="min-h-tap"
              autoFocus={focusField === 'building_name'}
              value={fields.building_name ?? ''}
              disabled={busy || disabled}
              onChange={(e) => setFields((f) => ({ ...f, building_name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-addr-floor">{t('review.address.floor', locale)}</Label>
            <Input
              id="onb-addr-floor"
              className="min-h-tap"
              autoFocus={focusField === 'floor'}
              value={fields.floor ?? ''}
              disabled={busy || disabled}
              onChange={(e) => setFields((f) => ({ ...f, floor: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-addr-full">{t('review.address.full', locale)}</Label>
            <Input
              id="onb-addr-full"
              className="min-h-tap"
              autoFocus={focusField === 'address'}
              value={fields.address ?? ''}
              disabled={busy || disabled}
              onChange={(e) => setFields((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('review.edit.cancel', locale)}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy || disabled}>
            {t('review.edit.save', locale)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
