# Deploy Checklist — Album

Seguir en orden. No pasar al siguiente bloque si el actual falla.

---

## 1. Supabase

- [ ] Ir a Supabase Dashboard → Settings → General → verificar que el proyecto **no** está en modo pausa.
- [ ] Deshabilitar confirmación por email para simplificar el onboarding inicial: Authentication → Email → desactivar "Enable email confirmations". (Reactivar cuando haya SMTP configurado.)
- [ ] Si se quiere email de confirmación: Authentication → SMTP Settings → configurar servidor SMTP propio (ej: Resend, SendGrid) — el SMTP de Supabase free tier tiene límites muy bajos.
- [ ] Verificar que las políticas RLS de `eventos` están activas: Database → Tables → eventos → RLS enabled.
- [ ] Verificar que las migraciones de Drizzle están aplicadas: Database → Tables → debe existir `eventos`, `invitados`, `archivos`.
- [ ] Anotar los valores de producción:
  - `SUPABASE_URL`: Project Settings → API → Project URL
  - `SUPABASE_ANON_KEY`: Project Settings → API → anon/public key
  - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → service_role key (⚠ nunca exponer en el frontend)

---

## 2. Cloudflare R2

- [ ] Ir a Cloudflare Dashboard → R2 → verificar que el bucket de producción existe (`R2_BUCKET_NAME`).
- [ ] Crear API Token con permisos solo para ese bucket: My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" como base → ajustar scope a R2 → Object Read & Write → solo el bucket de producción.
- [ ] Anotar:
  - `R2_ACCOUNT_ID`: Cloudflare → Overview → Account ID (barra lateral derecha)
  - `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`: del API Token recién creado
  - `R2_BUCKET_NAME`: nombre exacto del bucket
- [ ] Para mostrar imágenes públicamente (sin presigned URL de lectura), habilitar acceso público en el bucket: R2 → bucket → Settings → Public Access → Enable. Anotar la URL pública como `R2_PUBLIC_URL` (ej: `https://pub-xxxxxx.r2.dev`).
- [ ] Si se prefiere un dominio propio para las imágenes (ej: `media.album.com.ar`), configurar Custom Domain en R2 → Settings → Custom Domains → Add Domain → apuntar el CNAME en Cloudflare DNS.

---

## 3. Railway (apps/api)

- [ ] Crear proyecto en Railway → New Project → Deploy from GitHub → seleccionar el repo → apuntar a `apps/api`.
- [ ] En Railway → Variables, setear todas las siguientes (copiar los valores de los pasos anteriores):

  | Variable | Fuente |
  |----------|--------|
  | `NODE_ENV` | `production` |
  | `SUPABASE_URL` | Supabase → Project URL |
  | `SUPABASE_ANON_KEY` | Supabase → anon/public |
  | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → service_role |
  | `R2_ACCOUNT_ID` | Cloudflare → Account ID |
  | `R2_ACCESS_KEY_ID` | Cloudflare R2 API Token |
  | `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API Token |
  | `R2_BUCKET_NAME` | nombre del bucket |
  | `R2_PUBLIC_URL` | URL pública del bucket |
  | `INVITADO_JWT_SECRET` | generar con `openssl rand -base64 32` |
  | `UPSTASH_REDIS_REST_URL` | Upstash → Database → REST URL |
  | `UPSTASH_REDIS_REST_TOKEN` | Upstash → Database → REST Token |
  | `PUBLIC_APP_URL` | `https://www.album.com.ar` |

- [ ] En Railway → Settings → Networking → Custom Domain: agregar `api.album.com.ar`.
- [ ] Verificar que Railway muestra el dominio con certificado SSL activo.
- [ ] Hacer `GET https://api.album.com.ar/health` → debe responder `{ "status": "ok" }`.

---

## 4. Cloudflare DNS

- [ ] Ir a Cloudflare DNS del dominio `album.com.ar`.
- [ ] Agregar registro para la API:
  - Tipo: `CNAME`
  - Nombre: `api`
  - Target: dominio de Railway (ej: `album-api.up.railway.app`)
  - Proxy: **desactivado** (DNS only, nube gris) — Railway maneja su propio TLS
- [ ] Agregar/verificar el registro del frontend:
  - Para Vercel: seguir las instrucciones de Vercel → Project → Settings → Domains → Add Domain → `www.album.com.ar` → copiar los valores CNAME o A que indica Vercel.
  - Si Vercel pide un CNAME para `www`: Tipo `CNAME`, Nombre `www`, Target `cname.vercel-dns.com`
  - Si Vercel pide un A para el apex (`album.com.ar`): Tipo `A`, Nombre `@`, IP que indica Vercel.
- [ ] Verificar propagación DNS: `dig api.album.com.ar CNAME` debe apuntar al dominio de Railway.

---

## 5. Vercel (apps/web)

- [ ] Crear proyecto en Vercel → New Project → Import Git Repository → seleccionar el repo → **Root Directory: `apps/web`**.
- [ ] En Vercel → Project → Settings → Environment Variables, agregar:

  | Variable | Ámbito | Valor |
  |----------|--------|-------|
  | `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Supabase Project URL |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | Supabase anon/public |
  | `NEXT_PUBLIC_API_URL` | Production | `https://api.album.com.ar` |
  | `NEXT_PUBLIC_API_URL` | Development | `http://localhost:3001` |
  | `SUPABASE_SERVICE_ROLE_KEY` | Production (solo Server) | Supabase service_role |
  | `R2_PUBLIC_URL` | Production, Preview | URL pública del bucket R2 |

  > `SUPABASE_SERVICE_ROLE_KEY` es una variable privada (sin prefijo `NEXT_PUBLIC_`) — Vercel no la expone al browser, solo la usan los Server Components y Server Actions.

- [ ] Configurar dominio: Vercel → Project → Settings → Domains → Add → `www.album.com.ar` → seguir las instrucciones de DNS que aparecen.
- [ ] Hacer un deploy manual → verificar que `https://www.album.com.ar` carga correctamente.

---

## 6. turbo.json — verificar pipeline de build

- [ ] Verificar que `turbo.json` tiene la tarea `build` configurada con las dependencias correctas:
  ```json
  {
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": [".next/**", "dist/**"]
      },
      "dev": {
        "cache": false,
        "persistent": true
      }
    }
  }
  ```
- [ ] Correr `pnpm build` desde la raíz del monorepo y verificar que ambas apps compilan sin errores de TypeScript.
- [ ] Si Railway usa el Turborepo como punto de entrada, verificar que el `Dockerfile` o el Start Command en Railway apunta a `pnpm --filter @album/api start` (no al build del monorepo completo).

---

## 7. Verificación post-deploy

- [ ] `GET https://api.album.com.ar/health` → `{ "status": "ok" }` con código 200.
- [ ] Abrir `https://www.album.com.ar/registro` → cargar correctamente sin errores de consola.
- [ ] Crear un evento de prueba de punta a punta desde producción (seguir el QA Checklist completo en `docs/qa-checklist.md`).
- [ ] Verificar en Railway Logs que los logs de pino aparecen en formato JSON (sin colores, parseables).
- [ ] Correr manualmente el workflow de Supabase ping desde GitHub Actions y verificar que pasa.
- [ ] Confirmar en Upstash Dashboard que las claves de rate limiting aparecen después de las primeras peticiones al endpoint de registro.
