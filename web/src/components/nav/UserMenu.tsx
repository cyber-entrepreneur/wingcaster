import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export type NavLocale = 'en' | 'ar'

export const USER_MENU_COPY = {
  en: {
    profile: 'Your profile',
    preferences: 'Preferences',
    password: 'Change password',
    security: '2FA & security',
    signout: 'Sign out',
  },
  ar: {
    profile: 'ملفك الشخصي',
    preferences: 'التفضيلات',
    password: 'تغيير كلمة المرور',
    security: 'المصادقة الثنائية والأمان',
    signout: 'تسجيل الخروج',
  },
} as const

export type UserMenuUser = {
  id: string
  name: string
  email: string
  photoUrl?: string | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Deterministic Broadcast-token fallback fill from user id (no raw hex). */
export function avatarFallbackStyle(userId: string): CSSProperties {
  let hash = 0
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) | 0
  const mix = 18 + (Math.abs(hash) % 28)
  return {
    background: `color-mix(in srgb, var(--lc-action-primary) ${mix}%, var(--lc-surface-sunken))`,
    color: 'var(--lc-text-primary)',
  }
}

export interface UserMenuProps {
  user: UserMenuUser
  locale?: NavLocale
  onSignOut?: () => void
  className?: string
}

export function UserMenu({ user, locale = 'en', onSignOut, className }: UserMenuProps) {
  const copy = USER_MENU_COPY[locale]
  const navigate = useNavigate()

  const handleSignOut = () => {
    onSignOut?.()
    navigate('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-tap w-tap min-h-tap min-w-tap items-center justify-center rounded-md focus-visible:outline-none',
            className,
          )}
          aria-label={user.name}
        >
          <Avatar className="h-8 w-8">
            {user.photoUrl ? <AvatarImage src={user.photoUrl} alt="" /> : null}
            <AvatarFallback className="text-xs font-semibold" style={avatarFallbackStyle(user.id)}>
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[240px] rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-0 shadow-md"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center gap-3 p-3 font-normal">
          <Avatar className="h-12 w-12">
            {user.photoUrl ? <AvatarImage src={user.photoUrl} alt="" /> : null}
            <AvatarFallback className="text-sm font-semibold" style={avatarFallbackStyle(user.id)}>
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[var(--lc-text-primary)]">{user.name}</div>
            <div className="truncate text-xs text-[var(--lc-text-muted)]">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/profile">{copy.profile}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/preferences">{copy.preferences}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/security">{copy.password}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/security">{copy.security}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[var(--lc-status-unpublished-fg)] focus:text-[var(--lc-status-unpublished-fg)]"
          onSelect={(e) => {
            e.preventDefault()
            handleSignOut()
          }}
        >
          {copy.signout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
