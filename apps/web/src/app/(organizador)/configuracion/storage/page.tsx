import { obtenerStorageConfigStatus } from './actions'
import { StorageConfigForm } from './StorageConfigForm'

export default async function ConfiguracionStoragePage() {
  const status = await obtenerStorageConfigStatus()

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Configurá tu almacenamiento
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Album guarda las fotos y videos de tus invitados en tu propia cuenta de Cloudflare
          R2 — nunca en la nuestra. Necesitamos las credenciales de tu bucket antes de que
          puedas crear o administrar eventos.
        </p>
        <div className="mt-8">
          <StorageConfigForm status={status} />
        </div>
      </div>
    </div>
  )
}
