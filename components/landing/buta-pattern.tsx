import { useId } from 'react'
import { cn } from '@/lib/utils'

// One buta (Azerbaijani paisley) drawn in a 40×56 box: round body at the
// bottom, tip curling over to the right, inner contour and a few dots.
function Buta({ transform, color }: { transform: string; color: string }) {
  return (
    <g transform={transform}>
      <path d="M22 56 C10 56 4 47 6 36 C8 27 15 21 21 15 C25 11 28 7 33 5 C38 3 41 8 38 11 C36 13 33 12 33 10 C31 13 29 16 30 20 C31 24 36 28 38 36 C40 47 33 56 22 56 Z" />
      <path d="M22 50 C14 50 10 44 11 37 C12 31 17 26 23 22 C23 26 25 29 29 33 C32 37 32 43 29 46 C27 49 25 50 22 50 Z" />
      <circle cx="20" cy="40" r="2.4" fill={color} stroke="none" />
      <circle cx="15" cy="32" r="1.1" fill={color} stroke="none" />
      <circle cx="19" cy="27" r="1.1" fill={color} stroke="none" />
    </g>
  )
}

const ROSETTE = 'M0 -5 Q2 0 0 5 Q-2 0 0 -5 Z M-5 0 Q0 2 5 0 Q0 -2 -5 0 Z'

/**
 * Subtle tiled buta ornament. Purely decorative and deliberately faint: it
 * sits behind content and is usually faded out with a CSS mask.
 */
export function ButaPattern({
  className,
  opacity = 0.07,
  color = 'var(--landing-camel-dark)',
  size = 96,
}: {
  className?: string
  opacity?: number
  color?: string
  size?: number
}) {
  const id = `buta-${useId().replace(/:/g, '')}`
  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 size-full',
        className,
      )}
      style={{ opacity }}
    >
      <defs>
        <pattern
          id={id}
          width={size}
          height={(size * 112) / 96}
          patternUnits="userSpaceOnUse"
          viewBox="0 0 96 112"
        >
          <g
            fill="none"
            stroke={color}
            strokeWidth="1.3"
            strokeLinejoin="round"
          >
            <Buta transform="translate(6 2)" color={color} />
            <Buta transform="translate(94 54) scale(-1 1)" color={color} />
            <path transform="translate(76 26)" d={ROSETTE} />
            <path transform="translate(24 84)" d={ROSETTE} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** A thin ornamental band of small butas, used as a section edge. */
export function ButaBand({ className }: { className?: string }) {
  const id = `band-${useId().replace(/:/g, '')}`
  const color = 'var(--landing-camel-dark)'
  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none block h-5 w-full', className)}
    >
      <defs>
        <pattern
          id={id}
          width="44"
          height="20"
          patternUnits="userSpaceOnUse"
          viewBox="0 0 88 40"
        >
          <g fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round">
            <Buta
              transform="translate(4 36) rotate(-90) scale(.6)"
              color={color}
            />
            <circle cx="64" cy="20" r="2.4" fill={color} stroke="none" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity=".4" />
    </svg>
  )
}
