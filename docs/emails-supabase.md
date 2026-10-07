# Emails de Supabase Auth (Resend + plantillas)

Supabase Auth manda dos mails que Album necesita:

- **Confirmación del registro** del organizador.
- **Recuperar contraseña** ("¿Olvidaste tu contraseña?" → `/recuperar`).

Sin un SMTP propio, Supabase solo entrega mails a los miembros del equipo del proyecto y con un límite muy bajo por hora. Los organizadores reales no los reciben. Por eso se usa **Resend** como SMTP.

## 1. Resend

1. Crear la cuenta en https://resend.com.
2. **Domains → Add domain** → `album.com.ar`. En región, elegir **São Paulo (sa-east-1)**, la más cercana.
3. El DNS de `album.com.ar` está en Cloudflare. Resend ofrece **configurarlo automáticamente con Cloudflare**: aceptar. Si se hace a mano, copiar en Cloudflare → DNS los registros que muestra Resend (MX y TXT de SPF, y TXT de DKIM), con el proxy **apagado** (nube gris, "DNS only").
4. Esperar a que el dominio figure como **Verified**. Suele tardar unos minutos.
5. **API Keys → Create API key**: permiso **Sending access** y dominio `album.com.ar`. Copiar la key: Resend la muestra una sola vez.

Plan gratuito: 3.000 mails por mes y 100 por día.

## 2. Supabase → Authentication → Emails → SMTP Settings

Activar **Enable custom SMTP** y completar:

| Campo | Valor |
|---|---|
| Sender email | `no-reply@album.com.ar` |
| Sender name | `Album` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la API key de Resend |

Guardar con **Save changes**.

Después, en **Authentication → Rate Limits** está el límite de mails por hora. Con SMTP propio arranca en 30, que alcanza para empezar.

## 3. Supabase → Authentication → URL Configuration

- **Site URL:** `https://www.album.com.ar`
- **Redirect URLs** (agregar las dos):
  - `https://www.album.com.ar/**`
  - `http://localhost:3000/**`

## 4. Supabase → Authentication → Emails → Templates

Las plantillas usan `token_hash`, así el link funciona aunque el mail se abra en otro dispositivo, por ejemplo si se pidió desde la compu y se abre en el celular. El link llega a `/auth/confirm` (`apps/web/src/app/auth/confirm/route.ts`), que abre la sesión y redirige.

### Reset Password

**Subject:** `Elegí tu nueva contraseña de Album`

```html
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
  <h2 style="color: #1e293b;">Recuperar contraseña</h2>
  <p>Hola, recibimos un pedido para cambiar la contraseña de tu cuenta de Album.</p>
  <p style="margin: 28px 0;">
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/restablecer"
       style="background: #1e293b; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      Elegir contraseña nueva
    </a>
  </p>
  <p style="color: #64748b; font-size: 14px;">El link vence en 1 hora. Si no pediste este cambio, ignorá este mail: tu contraseña sigue igual.</p>
</div>
```

### Confirm signup

**Subject:** `Confirmá tu cuenta de Album`

```html
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
  <h2 style="color: #1e293b;">¡Bienvenido/a a Album!</h2>
  <p>Confirmá tu email para empezar a crear tus eventos.</p>
  <p style="margin: 28px 0;">
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/eventos"
       style="background: #1e293b; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      Confirmar mi cuenta
    </a>
  </p>
  <p style="color: #64748b; font-size: 14px;">Si no creaste una cuenta en Album, ignorá este mail.</p>
</div>
```

## Probar

- Los links de los mails usan el **Site URL** (producción), así que el circuito completo funciona una vez que `/auth/confirm`, `/recuperar` y `/restablecer` están deployados.
- **Para probar en local antes de deployar:** pedir el link desde http://localhost:3000/recuperar. En el mail, copiar el link del botón, cambiar `https://www.album.com.ar` por `http://localhost:3000` y abrirlo. El `token_hash` sirve en cualquier dominio.
- Si el link falla o ya se usó, `/auth/confirm` redirige a `/recuperar?error=link` (o a `/login?error=link` para la confirmación del registro).
