# SQL manual (Supabase SQL Editor)

Todo lo que no se aplica con `pnpm db:migrate` — políticas RLS, grants,
o cualquier otro SQL que el usuario corre a mano pegándolo en el SQL
Editor de Supabase — queda documentado acá como archivo, en vez de
quedar solo en el chat.

Convención de nombres: `NNNN_descripcion.sql`, prefijo numérico
correlativo (no tiene que coincidir con el número de `migrations/`,
son secuencias independientes). Cada archivo debe poder pegarse y
correr de punta a punta tal cual, sin edición previa.
