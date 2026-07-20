import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@album/database'

// This module runs only on the server (Server Actions, Server Components).
// Never import this in a Client Component.
const client = postgres(process.env.DATABASE_URL!, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })
export type DB = typeof db
