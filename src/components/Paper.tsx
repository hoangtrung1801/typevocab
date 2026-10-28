import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** 0–100; draws a thin red progress line along the top edge. */
  progress?: number
  label?: string
}

/** A sheet of notebook paper with a red margin line. */
export default function Paper({ children, className = '', progress, label }: Props) {
  return (
    <section
      aria-label={label}
      className={`relative rounded-[4px] border border-border bg-paper shadow-paper px-5 py-7 pl-12 sm:px-13 sm:py-10 sm:pl-23 ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-8 w-px bg-margin sm:left-16" />
      {progress !== undefined && (
        <span
          aria-hidden="true"
          className="absolute -top-px -left-px h-[3px] rounded-tl-[4px] bg-red transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      )}
      {children}
    </section>
  )
}
