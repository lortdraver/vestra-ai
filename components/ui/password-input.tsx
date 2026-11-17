'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const PASSWORD_MAX_LENGTH = 128

const toggleLabels = {
  show: { az: 'Şifrəni göstər', en: 'Show password', ru: 'Показать пароль' },
  hide: { az: 'Şifrəni gizlət', en: 'Hide password', ru: 'Скрыть пароль' },
} as const

/** Password field with an eye button to show or hide what was typed. */
export function PasswordInput({
  className,
  locale = 'en',
  ...props
}: Omit<ComponentProps<typeof Input>, 'type'> & {
  locale?: 'az' | 'en' | 'ru'
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        maxLength={props.maxLength ?? PASSWORD_MAX_LENGTH}
        className={cn('pr-11', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={toggleLabels[visible ? 'hide' : 'show'][locale]}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
