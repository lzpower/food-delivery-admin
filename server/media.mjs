import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export async function imageBuffer(input) {
  if (!Buffer.isBuffer(input) || !input.length || input.length > MAX_IMAGE_BYTES) throw Error('invalid-image');
  const image = sharp(input, { limitInputPixels: 25000000, failOn: 'error' });
  const m = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(m.format) || (m.pages || 1) > 1) throw Error('invalid-image');
  return image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
}
export function createMedia(env, client) {
  const fields = ['B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET', 'B2_ENDPOINT', 'IMAGE_PUBLIC_BASE'];
  if (fields.some(k => !env[k]?.trim())) return { ready: false };
  const endpoint = new URL(env.B2_ENDPOINT.trim()), base = new URL(env.IMAGE_PUBLIC_BASE.trim());
  if (endpoint.protocol !== 'https:' || !/^s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(endpoint.hostname) || endpoint.username || endpoint.password || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Cấu hình B2_ENDPOINT / IMAGE_PUBLIC_BASE không hợp lệ.');
  const bucket = env.B2_BUCKET.trim(), publicBase = base.href.replace(/\/+$/, '');
  const s3 = client || new S3Client({ region: endpoint.hostname.split('.')[1], endpoint: endpoint.origin, credentials: { accessKeyId: env.B2_KEY_ID.trim(), secretAccessKey: env.B2_APPLICATION_KEY.trim() }, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  return {
    ready: true,
    async check() { await s3.send(new HeadBucketCommand({ Bucket: bucket })); },
    async upload(bytes, kind, entityId) {
      if (!['foods', 'restaurants'].includes(kind) || !/^[a-f0-9-]{36}$/i.test(entityId)) throw Error('invalid-target');
      const key = `images/${kind}/${entityId}/${randomUUID()}.webp`;
      const result = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' }));
      return { key, versionId: result.VersionId, url: `${publicBase}/${key}` };
    },
    async remove(upload) { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: upload.key, ...(upload.versionId ? { VersionId: upload.versionId } : {}) })); },
  };
}
