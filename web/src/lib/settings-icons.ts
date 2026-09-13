import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bell,
  Building2,
  Clock,
  CreditCard,
  FileText,
  Flag,
  Globe,
  Globe2,
  KeyRound,
  Laptop,
  Monitor,
  Shield,
  ShieldCheck,
  Terminal,
  Trash2,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  user: User,
  'key-round': KeyRound,
  keyround: KeyRound,
  shield: Shield,
  'shield-check': ShieldCheck,
  shieldcheck: ShieldCheck,
  monitor: Monitor,
  laptop: Laptop,
  bell: Bell,
  'credit-card': CreditCard,
  creditcard: CreditCard,
  users: Users,
  'trash-2': Trash2,
  trash2: Trash2,
  globe: Globe,
  globe2: Globe2,
  clock: Clock,
  filetext: FileText,
  'file-text': FileText,
  wallet: Wallet,
  zap: Zap,
  terminal: Terminal,
  flag: Flag,
  building2: Building2,
  'alert-triangle': AlertTriangle,
  alerttriangle: AlertTriangle,
}

export function resolveSettingsIcon(name: string | undefined | null): LucideIcon {
  if (!name) return User
  const key = name.trim().toLowerCase().replace(/_/g, '-')
  return ICONS[key] ?? User
}
