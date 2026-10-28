import type { ReactNode } from 'react'

export default function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen px-4 pt-8 pb-16 sm:px-5 sm:pt-12">
      <div className={`mx-auto flex flex-col gap-4 ${wide ? 'max-w-[1120px]' : 'max-w-[820px]'}`}>{children}</div>
    </div>
  )
}
