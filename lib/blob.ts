// lib/blob.ts
import { put as _put, list as _list, del as _del, head as _head } from '@vercel/blob'

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN

if (!TOKEN || !TOKEN.trim()) {
  throw new Error('Missing BLOB_READ_WRITE_TOKEN')
}

/**
 * Upload a public blob.
 * Usage: await put('recipes/abc.html', htmlString)
 */
export async function put(path: string, data: string | ArrayBuffer | Buffer) {
  return _put(path, data as any, { access: 'public', token: TOKEN })
}

/**
 * List blobs, optionally by prefix.
 * Usage: const r = await list('recipes/')
 */
export async function list(prefix?: string, limit?: number) {
  return _list({ token: TOKEN, prefix, limit })
}

/**
 * Delete a blob by path.
 * Usage: await del('recipes/abc.html')
 */
export async function del(path: string) {
  return _del(path, { token: TOKEN })
}

/**
 * Get blob metadata (no body download).
 * Usage: const meta = await head('recipes/abc.html')
 */
export async function head(path: string) {
  return _head(path, { token: TOKEN })
}
