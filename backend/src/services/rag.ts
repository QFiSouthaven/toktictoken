import type { DB } from '../db/index.js';
import type { LMStudioClient } from './lmstudio.js';

export interface RagChunkHit {
  chunk_id: number;
  document_id: number;
  ord: number;
  content: string;
  distance: number;
}

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const clean = text.replace(/\r\n/g, '\n');
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + chunkSize, clean.length);
    out.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - overlap;
  }
  return out;
}

export async function ingestDocument(
  db: DB,
  lm: LMStudioClient,
  embeddingModel: string,
  doc: { title: string; mime: string; path: string; text: string },
): Promise<number> {
  const now = Date.now();
  const info = db
    .prepare('INSERT INTO documents (title, mime, path, created_at) VALUES (?, ?, ?, ?)')
    .run(doc.title, doc.mime, doc.path, now);
  const documentId = Number(info.lastInsertRowid);

  const chunks = chunkText(doc.text);
  if (chunks.length === 0) return documentId;

  const embeddings = await lm.embeddings(embeddingModel, chunks);

  const insertChunk = db.prepare(
    'INSERT INTO document_chunks (document_id, ord, content) VALUES (?, ?, ?)',
  );
  const insertVec = db.prepare('INSERT INTO vec_chunks (chunk_id, embedding) VALUES (?, ?)');

  const tx = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const r = insertChunk.run(documentId, i, chunks[i]);
      const chunkId = Number(r.lastInsertRowid);
      const emb = embeddings[i];
      if (emb) {
        insertVec.run(chunkId, Buffer.from(new Float32Array(emb).buffer));
      }
    }
  });
  tx();

  return documentId;
}

export async function searchSimilar(
  db: DB,
  lm: LMStudioClient,
  embeddingModel: string,
  query: string,
  k = 4,
): Promise<RagChunkHit[]> {
  const [embedding] = await lm.embeddings(embeddingModel, [query]);
  if (!embedding) return [];
  const rows = db
    .prepare(
      `SELECT v.chunk_id, v.distance, c.document_id, c.ord, c.content
       FROM vec_chunks v
       JOIN document_chunks c ON c.id = v.chunk_id
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`,
    )
    .all(Buffer.from(new Float32Array(embedding).buffer), k) as RagChunkHit[];
  return rows;
}
