import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url   = process.env.SUPABASE_URL;
const key   = process.env.SUPABASE_SERVICE_ROLE;   // service role ONLY (server)
const bucket= process.env.BUCKET;
const prefix= process.env.PREFIX || '';
const batchSize = Number(process.env.BATCH_SIZE || 1000);

if (!url || !key || !bucket) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE / BUCKET');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function listAll(prefix) {
  const files = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, {
      limit: batchSize,
      offset: page * batchSize,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const f of data) {
      if (f.id) continue; // folders come back as entries without "name"
      if (f.name && !f.metadata?.isDirectory) {
        files.push(`${prefix}${prefix && !prefix.endsWith('/') ? '/' : ''}${f.name}`);
      } else if (f.name && f.metadata?.isDirectory) {
        // Recurse into subfolders
        const nested = await listAll(`${prefix}${prefix && !prefix.endsWith('/') ? '/' : ''}${f.name}`);
        files.push(...nested);
      }
    }
    if (data.length < batchSize) break;
    page++;
  }
  return files;
}

async function removeInChunks(paths, chunk = 1000) {
  for (let i = 0; i < paths.length; i += chunk) {
    const slice = paths.slice(i, i + chunk);
    const { data, error } = await sb.storage.from(bucket).remove(slice);
    if (error) throw error;
    console.log(`Deleted ${slice.length} objects...`);
  }
}

(async () => {
  console.log(`Listing objects in bucket "${bucket}" with prefix "${prefix}"...`);
  const all = await listAll(prefix);
  console.log(`Found ${all.length} objects to delete.`);

  if (!all.length) return console.log('Nothing to delete.');

  // FINAL CONFIRMATION (comment out to run non-interactive)
  // console.log(all.slice(0, 10)); // sample
  // process.stdout.write('Type "YES" to delete: ');
  // process.stdin.setEncoding('utf8');
  // process.stdin.on('data', async (txt) => {
  //   if (txt.trim() === 'YES') {
      await removeInChunks(all, 1000);
      console.log('Done.');
      process.exit(0);
  //   } else {
  //     console.log('Aborted.');
  //     process.exit(1);
  //   }
  // });
})();
