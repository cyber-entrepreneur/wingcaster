/**
 * Celebration burst for AGT-ONB-004. Broadcast palette only, read from
 * computed `--lc-*` tokens (no raw hex in source). Caps at 1.2s.
 */

const PARTICLE_TOKENS = [
  '--lc-action-primary',
  '--lc-accent-bold',
  '--lc-status-published-fg',
  '--lc-text-brand',
] as const

const DURATION_MS = 1200
const PARTICLE_COUNT = 48

function tokenColor(name: string): string {
  if (typeof document === 'undefined') return 'currentColor'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor'
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function fireOnboardingConfetti(root: HTMLElement): () => void {
  const colors = PARTICLE_TOKENS.map(tokenColor)
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.setAttribute('data-onboarding-confetti', 'true')
  layer.style.cssText =
    'pointer-events:none;position:fixed;inset:0;overflow:hidden;z-index:var(--lc-z-overlay,40)'

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const particle = document.createElement('span')
    const color = colors[i % colors.length]
    const left = 8 + Math.random() * 84
    const delay = Math.random() * 180
    const drift = (Math.random() - 0.5) * 80
    const size = 6 + Math.random() * 8
    particle.style.cssText = [
      'position:absolute',
      `left:${left}%`,
      'top:-12px',
      `width:${size}px`,
      `height:${size * 0.45}px`,
      `background:${color}`,
      'border-radius:1px',
      `animation:agt-onb-confetti ${DURATION_MS}ms var(--lc-easing-out,ease-out) ${delay}ms both`,
      `--agt-onb-drift:${drift}px`,
    ].join(';')
    layer.appendChild(particle)
  }

  if (!document.getElementById('agt-onb-confetti-keyframes')) {
    const style = document.createElement('style')
    style.id = 'agt-onb-confetti-keyframes'
    style.textContent = `@keyframes agt-onb-confetti{0%{transform:translate3d(0,0,0) rotate(0deg);opacity:1}100%{transform:translate3d(var(--agt-onb-drift,0),110vh,0) rotate(220deg);opacity:0}}`
    document.head.appendChild(style)
  }

  root.appendChild(layer)
  const timeout = window.setTimeout(() => {
    layer.remove()
  }, DURATION_MS + 200)

  return () => {
    window.clearTimeout(timeout)
    layer.remove()
  }
}
