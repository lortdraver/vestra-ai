// Hand-drawn, flat garment illustrations in the site's editorial palette.
// Strokes use `currentColor` (ink); fills are passed in so each piece can be
// tinted with the theme colours.

type GarmentProps = {
  fill?: string
  detail?: string
  className?: string
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
}

export function CoatIllustration({
  fill = 'var(--landing-camel)',
  detail = 'var(--landing-camel-dark)',
  className,
}: GarmentProps) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden="true">
      {/* sleeves */}
      <path
        d="M34 30 L16 44 L10 120 L22 122 L30 70 Z"
        fill={fill}
        {...stroke}
      />
      <path
        d="M86 30 L104 44 L110 120 L98 122 L90 70 Z"
        fill={fill}
        {...stroke}
      />
      {/* body */}
      <path
        d="M34 30 L48 22 L60 34 L72 22 L86 30 L92 150 L28 150 Z"
        fill={fill}
        {...stroke}
      />
      {/* lapels */}
      <path d="M48 22 L44 52 L60 74 L60 34 Z" fill={detail} {...stroke} />
      <path d="M72 22 L76 52 L60 74 L60 34 Z" fill={detail} {...stroke} />
      {/* front edge, belt, buttons, pockets */}
      <path d="M60 74 L58 150" fill="none" {...stroke} />
      <path d="M30 96 L90 96" fill="none" {...stroke} />
      <rect
        x="54"
        y="92"
        width="10"
        height="8"
        rx="1.5"
        fill={detail}
        {...stroke}
      />
      <circle cx="66" cy="82" r="1.8" fill="currentColor" />
      <circle cx="66" cy="114" r="1.8" fill="currentColor" />
      <path d="M36 118 L50 118" fill="none" {...stroke} />
      <path d="M70 118 L84 118" fill="none" {...stroke} />
    </svg>
  )
}

export function SweaterIllustration({
  fill = 'var(--landing-cream)',
  detail = 'var(--landing-cream-dark)',
  className,
}: GarmentProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <path
        d="M38 18 L16 30 L8 92 L22 96 L30 54 L30 104 L90 104 L90 54 L98 96 L112 92 L104 30 L82 18 Q60 30 38 18 Z"
        fill={fill}
        {...stroke}
      />
      {/* collar */}
      <path d="M44 20 Q60 32 76 20" fill="none" {...stroke} />
      {/* ribbing */}
      <path d="M30 96 L90 96" fill="none" {...stroke} />
      {[38, 46, 54, 62, 70, 78, 86].map((x) => (
        <path
          key={x}
          d={`M${x} 97 L${x} 103`}
          stroke={detail}
          strokeWidth="1.4"
        />
      ))}
      {/* cable knit */}
      <path
        d="M60 34 Q54 42 60 50 Q66 58 60 66 Q54 74 60 82 Q66 88 60 94"
        fill="none"
        stroke={detail}
        strokeWidth="1.6"
      />
      <path d="M12 86 L23 89" stroke={detail} strokeWidth="1.4" />
      <path d="M108 86 L97 89" stroke={detail} strokeWidth="1.4" />
    </svg>
  )
}

export function JeansIllustration({
  fill = 'var(--landing-denim)',
  detail = 'var(--landing-denim-light)',
  className,
}: GarmentProps) {
  return (
    <svg viewBox="0 0 100 150" className={className} aria-hidden="true">
      <path
        d="M22 10 L78 10 L84 144 L60 144 L50 46 L40 144 L16 144 Z"
        fill={fill}
        {...stroke}
      />
      <path d="M22 20 L78 20" fill="none" {...stroke} />
      <path d="M50 20 L50 46" fill="none" stroke={detail} strokeWidth="1.4" />
      <path
        d="M26 24 Q32 34 42 26"
        fill="none"
        stroke={detail}
        strokeWidth="1.4"
      />
      <path
        d="M74 24 Q68 34 58 26"
        fill="none"
        stroke={detail}
        strokeWidth="1.4"
      />
      <circle cx="54" cy="15" r="1.6" fill={detail} />
      <path d="M18 132 L40 132" stroke={detail} strokeWidth="1.4" />
      <path d="M60 132 L82 132" stroke={detail} strokeWidth="1.4" />
    </svg>
  )
}

export function BootIllustration({
  fill = 'var(--landing-ink)',
  detail = 'var(--landing-camel)',
  className,
}: GarmentProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
      <path
        d="M30 8 L58 8 L60 52 Q78 54 98 64 Q110 70 110 80 L110 86 L22 86 L22 60 Z"
        fill={fill}
        {...stroke}
      />
      <path d="M20 86 L112 86 L112 94 L20 94 Z" fill={detail} {...stroke} />
      {[22, 30, 38, 46].map((y) => (
        <path
          key={y}
          d={`M44 ${y} L58 ${y + 2}`}
          stroke={detail}
          strokeWidth="1.6"
        />
      ))}
      <path
        d="M30 8 Q44 14 58 8"
        fill="none"
        stroke={detail}
        strokeWidth="1.4"
      />
    </svg>
  )
}

export function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect
        x="6"
        y="14"
        width="36"
        height="24"
        rx="5"
        fill="var(--landing-cream)"
        {...stroke}
      />
      <path
        d="M17 14 L20 9 L28 9 L31 14"
        fill="var(--landing-cream)"
        {...stroke}
      />
      <circle cx="24" cy="26" r="7" fill="var(--landing-camel)" {...stroke} />
      <circle cx="24" cy="26" r="2.5" fill="currentColor" />
    </svg>
  )
}

export function SparkTagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M8 22 L22 8 L38 8 L40 10 L40 26 L26 40 Z"
        fill="var(--landing-cream)"
        {...stroke}
      />
      <circle cx="32" cy="16" r="3" fill="var(--landing-camel)" {...stroke} />
      <path d="M17 29 L24 22" {...stroke} fill="none" />
      <path d="M42 34 L42 42 M38 38 L46 38" {...stroke} fill="none" />
    </svg>
  )
}

export function OutfitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M18 8 L10 12 L8 26 L13 27 L15 18 L15 30 L33 30 L33 18 L35 27 L40 26 L38 12 L30 8 Q24 13 18 8 Z"
        fill="var(--landing-camel)"
        {...stroke}
      />
      <path
        d="M16 32 L32 32 L33 44 L26 44 L24 36 L22 44 L15 44 Z"
        fill="var(--landing-denim)"
        {...stroke}
      />
    </svg>
  )
}
