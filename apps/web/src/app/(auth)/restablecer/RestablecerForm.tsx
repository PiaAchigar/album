'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock } from 'lucide-react'
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
import { actualizarContrasena } from '@/app/(organizador)/actions/auth.actions'

// Same rule as the signup form (registro/page.tsx).
const schema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((v) => v.password === v.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  })

type Values = z.infer<typeof schema>

export function RestablecerForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmar: '' },
  })

  async function onSubmit(values: Values) {
    setServerError(null)
    const result = await actualizarContrasena(values.password)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    router.push('/eventos')
    router.refresh()
  }

  const campos = [
    { name: 'password' as const, label: 'Contraseña nueva', autoComplete: 'new-password' },
    { name: 'confirmar' as const, label: 'Repetila', autoComplete: 'new-password' },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {campos.map(({ name, label, autoComplete }) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={autoComplete}
                      className="h-12 pl-12 pr-12"
                      {...field}
                    />
                    {name === 'password' && (
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button
          type="submit"
          className="h-12 w-full text-sm font-semibold uppercase tracking-widest"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
      </form>
    </Form>
  )
}
