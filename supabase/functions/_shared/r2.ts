
// supabase/functions/_shared/r2.ts
import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

// Get R2 configuration from environment variables
const accountId = Deno.env.get("CLOUDFLARE_R2_ACCOUNT_ID");
const accessKey = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID");
const secretKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
export const BUCKET_PUBLIC = Deno.env.get("R2_BUCKET_PUBLIC");
export const BUCKET_PRIVATE = Deno.env.get("R2_BUCKET_PRIVATE");
export const PUBLIC_BASE = Deno.env.get("R2_PUBLIC_BASE_URL") || "";

// Check if R2 is properly configured
export const isR2Configured = !!(accountId && accessKey && secretKey && BUCKET_PRIVATE);

let r2Client: S3Client | null = null;

// Initialize R2 client only if properly configured
if (isR2Configured) {
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
    forcePathStyle: true, // This ensures bucket name goes in path, not subdomain
  });
  
  console.log(`✅ R2 client initialized successfully for account ${accountId?.substring(0, 8)}...`);
} else {
  console.error(`❌ R2 configuration incomplete:`, {
    hasAccountId: !!accountId,
    hasAccessKey: !!accessKey,
    hasSecretKey: !!secretKey,
    hasBucketPrivate: !!BUCKET_PRIVATE,
    hasBucketPublic: !!BUCKET_PUBLIC
  });
}

export const r2 = r2Client;

export async function getPrivateSignedUrl(key: string, ttlSeconds = 3600) {
  if (!r2 || !BUCKET_PRIVATE) {
    throw new Error("R2 is not properly configured - cannot generate signed URL");
  }
  
  const cmd = new GetObjectCommand({ Bucket: BUCKET_PRIVATE, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn: ttlSeconds });
}

export async function uploadToR2(opts: { key: string; body: Uint8Array | ReadableStream | Blob; contentType?: string; isPublic: boolean }) {
  if (!r2) {
    throw new Error("R2 is not properly configured - cannot upload file");
  }
  
  const Bucket = opts.isPublic ? BUCKET_PUBLIC : BUCKET_PRIVATE;
  if (!Bucket) {
    throw new Error(`R2 bucket not configured for ${opts.isPublic ? 'public' : 'private'} files`);
  }
  
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
  if (!r2 || !BUCKET_PUBLIC || !BUCKET_PRIVATE) {
    throw new Error("R2 is not properly configured - cannot move files between buckets");
  }
  
  const SourceBucket = toPublic ? BUCKET_PRIVATE : BUCKET_PUBLIC;
  const DestBucket   = toPublic ? BUCKET_PUBLIC  : BUCKET_PRIVATE;
  await r2.send(new CopyObjectCommand({ Bucket: DestBucket, Key: key, CopySource: `/${SourceBucket}/${encodeURIComponent(key)}` }));
  await r2.send(new DeleteObjectCommand({ Bucket: SourceBucket, Key: key }));
  return toPublic && PUBLIC_BASE ? `${PUBLIC_BASE}/${encodeURIComponent(key)}` : null;
}
