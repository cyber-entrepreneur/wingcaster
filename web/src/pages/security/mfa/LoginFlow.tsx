import { useSearchParams } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { SignInChallengePage } from './SignInChallengePage'
import { BackupCodeSignInPage } from './BackupCodeSignInPage'

/**
 * `/login` flow wrapper (SHR-MFA-004 / 004b).
 * Delegates to existing LoginPage when `stage` is absent.
 * Does not rewrite LoginPage.
 */
export function LoginFlow() {
  const [params] = useSearchParams()
  const stage = params.get('stage')
  if (stage === '2fa') return <SignInChallengePage />
  if (stage === 'backup') return <BackupCodeSignInPage />
  return <LoginPage />
}
