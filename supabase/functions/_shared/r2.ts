// supabase/functions/_shared/r2.ts
import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const accountId = Deno.env.get("CLOUDFLARE_R2_ACCOUNT_ID")!;
const endpoint  = Deno.env.get("CLOUDFLARE_R2_ENDPOINT") || `https://${accountId}.r2.cloudflarestorage.com`;
const accessKey = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID")!;
const secretKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")!;
export const BUCKET_PUBLIC  = Deno.env.get("R2_BUCKET_PUBLIC")!;
export const BUCKET_PRIVATE = Deno.env.get("R2_BUCKET_PRIVATE")!;
export const PUBLIC_BASE    = Deno.env.get("R2_PUBLIC_BASE_URL") || "";

export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

export async function getPrivateSignedUrl(key: string, ttlSeconds = 3600) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET_PRIVATE, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn: ttlSeconds });
}

export async function uploadToR2(opts: { key: string; body: Uint8Array | ReadableStream | Blob; contentType?: string; isPublic: boolean }) {
  const Bucket = opts.isPublic ? BUCKET_PUBLIC : BUCKET_PRIVATE;
  await r2.send(new PutObjectCommand({
    Bucket,
    Key: opts.key,
    Body: opts.body,
    ContentType: opts.contentType,
    ...(opts.isPublic ? { CacheControl: "public, max-age=31536000, immutable" } : {}),
  }));
  return opts.isPublic && PUBLIC_BASE ? `${PUBLIC_BASE}/${encodeURIComponent(opts.key)}` : null;
}

export async function moveBetweenBuckets(key: string, toPublic: boolean) {
  const SourceBucket = toPublic ? BUCKET_PRIVATE : BUCKET_PUBLIC;
  const DestBucket   = toPublic ? BUCKET_PUBLIC  : BUCKET_PRIVATE;
  await r2.send(new CopyObjectCommand({ Bucket: DestBucket, Key: key, CopySource: `/${SourceBucket}/${encodeURIComponent(key)}` }));
  await r2.send(new DeleteObjectCommand({ Bucket: SourceBucket, Key: key }));
  return toPublic && PUBLIC_BASE ? `${PUBLIC_BASE}/${encodeURIComponent(key)}` : null;
}
