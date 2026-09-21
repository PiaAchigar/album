'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound } from 'lucide-react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { guardarStorageConfig } from './actions'

const schema = z.object({
  r2_account_id: z.string().min(1, 'Obligatorio'),
  r2_access_key_id: z.string().min(1, 'Obligatorio'),
  r2_secret_access_key: z.string().min(1, 'Obligatorio'),
  r2_bucket_name: z.string().min(1, 'Obligatorio'),
})

type Values = z.infer<typeof schema>

type Status = { configurado: false } | { configurado: true; bucket: string; terminaEn: string }

interface Props {
  status: Status
}

export function StorageConfigForm({ status }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [editing, setEditing] = useState(!status.configurado)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      r2_account_id: '',
      r2_access_key_id: '',
      r2_secret_access_key: '',
      r2_bucket_name: '',
    },
  })

  async function onSubmit(values: Values) {
    setServerError(null)
    const result = await guardarStorageConfig(values)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    router.push('/eventos')
    router.refresh()
  }

  if (status.configurado && !editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Configurado — bucket &quot;{status.bucket}&quot;
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Access key terminada en …{status.terminaEn}
            </p>
          </div>
        </div>
        <Button variant="outline" className="h-11 w-full" onClick={() => setEditing(true)}>
          Cambiar credenciales
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="r2_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Account ID
              </FormLabel>
              <FormControl>
                <Input placeholder="Account ID de Cloudflare" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="r2_access_key_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Access Key ID
              </FormLabel>
              <FormControl>
                <Input placeholder="Access Key ID" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="r2_secret_access_key"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Secret Access Key
              </FormLabel>
              <FormControl>
                <Input type="password" placeholder="Secret Access Key" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="r2_bucket_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Nombre del bucket
              </FormLabel>
              <FormControl>
                <Input placeholder="mi-bucket" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button
          type="submit"
          className="h-11 w-full gap-2 text-sm font-semibold uppercase tracking-widest"
          disabled={form.formState.isSubmitting}
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {form.formState.isSubmitting ? 'Verificando…' : 'Guardar y verificar'}
        </Button>
      </form>
    </Form>
  )
}
