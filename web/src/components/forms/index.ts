/**
 * Form primitives shared across agent submission + auth screens.
 *
 * Family path: `web/src/components/forms/`
 * Source briefs: AGT-APR-004, AGT-APR-005, SHR-AUT-006, AGN-MEM-005.
 */

export {
  EvidenceUploader,
  type EvidenceFile,
  type EvidenceUploaderProps,
} from './EvidenceUploader'

export {
  ContextEchoCard,
  type ContextEchoCardProps,
  type ContextEchoMetaItem,
} from './ContextEchoCard'

export {
  IdentityForm,
  EMPTY_IDENTITY_FORM_VALUES,
  estimatePasswordStrength,
  isEmailValid,
  isUsernameValid,
  isPhoneValid,
  isPasswordAcceptable,
  isIdentityFormValid,
  normalizePhoneE164,
  type IdentityFormProps,
  type IdentityFormValues,
  type IdentityFormFieldErrors,
  type IdentityIdentifierType,
  type PasswordStrength,
} from './IdentityForm'
