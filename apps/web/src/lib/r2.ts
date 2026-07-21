import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { nanoid } from 'nanoid'

function getS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID
  if (!accountId) throw new Error('R2_ACCOUNT_ID is not set')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

export async function getOrganizadorPresignedUpload(
  eventoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error('R2_BUCKET_NAME is not set')

  const r2Key = `eventos/${eventoId}/portada/${nanoid()}.${extension}`
  const client = getS3Client()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: r2Key,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  return { uploadUrl, r2Key }
}
