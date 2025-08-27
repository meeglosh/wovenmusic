import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import fs from 'node:fs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  }
});

const BUCKET_PUBLIC = process.env.R2_BUCKET_PUBLIC;
const BUCKET_PRIVATE = process.env.R2_BUCKET_PRIVATE;
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE_URL || '';

/** small helpers **/
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (s) => (console.log(s), fs.appendFileSync('migrate.log', s + '\n'));

function guessExtFromContentType(ct) {
  if (!ct) return 'bin';
  if (ct.includes('audio/mpeg')) return 'mp3';
  if (ct.includes('audio/mp4') || ct.includes('audio/aac') || ct.includes('audio/x-m4a')) return 'm4a';
  if (ct.includes('audio/wav')) return 'wav';
  if (ct.includes('audio/x-aiff') || ct.includes('audio/aiff')) return 'aif';
  if (ct.includes('image/png')) return 'png';
  if (ct.includes('image/jpeg')) return 'jpg';
  if (ct.includes('image/webp')) return 'webp';
  return 'bin';
}

function contentTypeFromUrlOrPath(url) {
  const u = (url || '').toLowerCase();
  if (u.endsWith('.mp3')) return 'audio/mpeg';
  if (u.endsWith('.m4a') || u.endsWith('.aac')) return 'audio/mp4';
  if (u.endsWith('.wav')) return 'audio/wav';
  if (u.endsWith('.aif') || u.endsWith('.aiff')) return 'audio/x-aiff';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  if (u.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function uploadToR2({ key, body, contentType, isPublic }) {
  const Bucket = isPublic ? BUCKET_PUBLIC : BUCKET_PRIVATE;
  await r2.send(new PutObjectCommand({
    Bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(isPublic ? { CacheControl: 'public, max-age=31536000, immutable' } : {})
  }));
  // Optional verify
  await r2.send(new HeadObjectCommand({ Bucket, Key: key }));
  return isPublic && PUBLIC_BASE ? `${PUBLIC_BASE}/${encodeURIComponent(key)}` : null;
}

async function fetchBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${resp.status} ${url}`);
  const ct = resp.headers.get('content-type');
  const arrayBuf = await resp.arrayBuffer();
  return { buffer: Buffer.from(arrayBuf), contentType: ct || contentTypeFromUrlOrPath(url) };
}

/** 1) Migrate tracks (audio) **/
async function migrateTracks({ batchSize = 50 }) {
  log('--- MIGRATE TRACKS START ---');

  // Pull tracks not yet on R2 (adjust filters to your schema)
  const { data: tracks, error } = await supabase
    .from('tracks')
    .select('id, title, is_public, storage_type, storage_key, storage_url, file_url')
    .order('id', { ascending: true });

  if (error) throw error;

  let migrated = 0, skipped = 0, failed = 0;

  for (const t of tracks) {
    try {
      if (t.storage_type === 'r2' && t.storage_key) {
        skipped++;
        continue; // already migrated
      }

      // Determine source URL (legacy)
      let srcUrl = t.storage_url || t.file_url;
      if (!srcUrl || srcUrl === '#' || srcUrl === '') {
        log(`SKIP no source url for track ${t.id} ${t.title}`);
        skipped++; continue;
      }

      const { buffer, contentType } = await fetchBuffer(srcUrl);

      // Choose destination key
      const extGuess = guessExtFromContentType(contentType);
      const key = t.storage_key || `tracks/${t.id}.${extGuess}`;

      const publicUrl = await uploadToR2({
        key,
        body: buffer,
        contentType,
        isPublic: !!t.is_public
      });

      // Update DB
      const updates = {
        storage_type: 'r2',
        storage_key: key,
        storage_url: publicUrl || null
      };

      const { error: upErr } = await supabase
        .from('tracks')
        .update(updates)
        .eq('id', t.id);

      if (upErr) throw upErr;

      log(`OK track ${t.id} ${t.title} -> ${t.is_public ? 'public' : 'private'}:${key}`);
      migrated++;

      // be gentle
      if (migrated % batchSize === 0) await sleep(250);
    } catch (e) {
      log(`FAIL track ${t.id} ${t.title}: ${e.message}`);
      failed++;
    }
  }

  log(`--- MIGRATE TRACKS DONE: migrated=${migrated}, skipped=${skipped}, failed=${failed} ---`);
}

/** 2) Migrate images (playlist covers, profile avatars) **/
async function migrateImages() {
  log('--- MIGRATE IMAGES START ---');

  // Adjust table/column names to your schema:
  const imageJobs = [
    { table: 'playlists', idCol: 'id', urlCol: 'image_url', destPrefix: 'images/playlists' },
    { table: 'profiles',  idCol: 'id', urlCol: 'avatar_url', destPrefix: 'images/avatars' }
  ];

  for (const job of imageJobs) {
    const { data: rows, error } = await supabase
      .from(job.table)
      .select(`${job.idCol}, ${job.urlCol}`)
      .order(job.idCol, { ascending: true });
    if (error) throw error;

    let migrated = 0, skipped = 0, failed = 0;

    for (const r of rows) {
      const id = r[job.idCol];
      const url = r[job.urlCol];
      if (!url) { skipped++; continue; }
      // Skip if already on your R2 CDN
      if (PUBLIC_BASE && url.startsWith(PUBLIC_BASE)) { skipped++; continue; }

      try {
        const { buffer, contentType } = await fetchBuffer(url);
        const ext = guessExtFromContentType(contentType);
        const key = `${job.destPrefix}/${id}.${ext}`;

        const publicUrl = await uploadToR2({
          key,
          body: buffer,
          contentType,
          isPublic: true // images should be public for sharing; change if needed
        });

        const { error: upErr } = await supabase
          .from(job.table)
          .update({ [job.urlCol]: publicUrl })
          .eq(job.idCol, id);

        if (upErr) throw upErr;

        log(`OK ${job.table} ${id} -> ${key}`);
        migrated++;
      } catch (e) {
        log(`FAIL ${job.table} ${id}: ${e.message}`);
        failed++;
      }
    }

    log(`--- ${job.table.toUpperCase()} IMAGES: migrated=${migrated}, skipped=${skipped}, failed=${failed} ---`);
  }

  log('--- MIGRATE IMAGES DONE ---');
}

(async () => {
  try {
    await migrateTracks({ batchSize: 50 });
    await migrateImages();
    console.log('Migration complete. See migrate.log for details.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
})();
