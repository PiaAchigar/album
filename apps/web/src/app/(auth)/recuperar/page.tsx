import type { Metadata } from 'next'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { RecuperarForm } from './RecuperarForm'

export const metadata: Metadata = {
  title: 'Recuperar contraseña — Album',
}

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function RecuperarPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="ctx-organizador flex flex-1 flex-col bg-backdrop">
      <OrganizadorTopbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px] rounded-xl border border-border bg-card p-8 shadow-sm sm:p-12">
          <RecuperarForm linkVencido={error === 'link'} />
        </div>
      </main>
    </div>
  )
}
