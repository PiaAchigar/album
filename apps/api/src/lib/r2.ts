import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { eventos, organizadorStorageConfig } from '@album/database'
import { decryptSecret } from './crypto.js'

export class StorageNoConfiguradoError extends Error {
  constructor() {
    super('El organizador todavía no configuró su storage de R2')
    this.name = 'StorageNoConfiguradoError'
  }
}

export interface OrganizadorR2Client {
  client: S3Client
  bucket: string
}

export function buildS3Client(config: {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}): OrganizadorR2Client {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return { client, bucket: config.bucket }
}

async function resolveFromRow(
  row: typeof organizadorStorageConfig.$inferSelect,
): Promise<OrganizadorR2Client> {
  if (!row.verificado_at) throw new StorageNoConfiguradoError()

  return buildS3Client({
    accountId: decryptSecret({
      cipher: row.r2_account_id_cipher,
      iv: row.r2_account_id_iv,
      tag: row.r2_account_id_tag,
    }),
    accessKeyId: decryptSecret({
      cipher: row.r2_access_key_id_cipher,
      iv: row.r2_access_key_id_iv,
      tag: row.r2_access_key_id_tag,
    }),
    secretAccessKey: decryptSecret({
      cipher: row.r2_secret_access_key_cipher,
      iv: row.r2_secret_access_key_iv,
      tag: row.r2_secret_access_key_tag,
    }),
    bucket: decryptSecret({
      cipher: row.r2_bucket_name_cipher,
      iv: row.r2_bucket_name_iv,
      tag: row.r2_bucket_name_tag,
    }),
  })
}

export async function getS3ClientForOrganizador(
  organizadorId: string,
): Promise<OrganizadorR2Client> {
  const [row] = await db
    .select()
    .from(organizadorStorageConfig)
    .where(eq(organizadorStorageConfig.organizador_id, organizadorId))
    .limit(1)

  if (!row) throw new StorageNoConfiguradoError()
  return resolveFromRow(row)
}

export async function getS3ClientForEvento(eventoId: string): Promise<OrganizadorR2Client> {
  const [row] = await db
    .select({ organizador_id: eventos.organizador_id })
    .from(eventos)
    .where(eq(eventos.id, eventoId))
    .limit(1)

  if (!row) throw new StorageNoConfiguradoError()
  return getS3ClientForOrganizador(row.organizador_id)
}

export async function getInvitadoPresignedUpload(
  { client, bucket }: OrganizadorR2Client,
  eventoId: string,
  invitadoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  const r2Key = `eventos/${eventoId}/${invitadoId}/${nanoid()}.${extension}`
  const command = new PutObjectCommand({ Bucket: bucket, Key: r2Key })
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  return { uploadUrl, r2Key }
}

export async function getPortadaPresignedUpload(
  { client, bucket }: OrganizadorR2Client,
  eventoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  const r2Key = `eventos/${eventoId}/portada/${nanoid()}.${extension}`
  const command = new PutObjectCommand({ Bucket: bucket, Key: r2Key })
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  return { uploadUrl, r2Key }
}

export async function getPresignedReadUrl(
  { client, bucket }: OrganizadorR2Client,
  r2Key: string,
  expiresIn = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: r2Key })
  return getSignedUrl(client, command, { expiresIn })
}

export async function deleteR2Object(
  { client, bucket }: OrganizadorR2Client,
  r2Key: string,
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }))
}

export async function testR2Credentials(clientInfo: OrganizadorR2Client): Promise<void> {
  const testKey = `_album-verificacion/${nanoid()}.txt`
  await clientInfo.client.send(
    new PutObjectCommand({ Bucket: clientInfo.bucket, Key: testKey, Body: 'album-verificacion' }),
  )
  await clientInfo.client.send(
    new DeleteObjectCommand({ Bucket: clientInfo.bucket, Key: testKey }),
  )
}
