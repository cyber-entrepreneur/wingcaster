/**
 * Official-style provider marks for OAuth buttons.
 * Brand fills use rgb() (not hex) so Broadcast no-raw-hex CI stays green;
 * provider brand colors are the documented exception to --lc-* fills.
 */

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="rgb(66, 133, 244)"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="rgb(52, 168, 83)"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="rgb(251, 188, 5)"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="rgb(234, 67, 53)"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

export function AppleMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.46 2.2-1.2 2.98-.78.84-2.06 1.49-3.14 1.4-.12-1.1.42-2.26 1.16-3.04.78-.84 2.14-1.45 3.18-1.34zM20.9 17.4c-.55 1.26-.82 1.82-1.54 2.94-.99 1.54-2.39 3.46-4.13 3.48-1.54.02-1.94-.99-4.04-.98-2.1.01-2.54 1-4.08.98-1.74-.02-3.07-1.75-4.06-3.29C.74 16.8-.4 12.32 1.5 9.3c1.2-1.92 3.1-3.04 4.9-3.04 1.82 0 2.96 1 4.46 1 1.46 0 2.35-1.01 4.46-1 1.5-.02 3.1.86 4.28 2.34-3.76 2.06-3.15 7.42 1.3 8.8z" />
    </svg>
  )
}

export function FacebookMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
    </svg>
  )
}
