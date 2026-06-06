import type { HistoryRecord } from '@/types'

const DB_NAME = 'voiceover-history'
const STORE_NAME = 'records'
const MAX_RECORDS = 20

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveRecord(record: HistoryRecord): Promise<void> {
  let db: IDBDatabase
  try {
    db = await openDB()
  } catch {
    const key = 'voh-fallback'
    const existing = JSON.parse(sessionStorage.getItem(key) ?? '[]')
    const slim = { id: record.id, createdAt: record.createdAt, chineseText: record.chineseText, englishText: record.englishText }
    sessionStorage.setItem(key, JSON.stringify([slim, ...existing].slice(0, MAX_RECORDS)))
    return
  }

  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await req(store.put(record))

  const allKeys = await req(store.index('createdAt').getAllKeys())
  if (allKeys.length > MAX_RECORDS) {
    for (const key of allKeys.slice(0, allKeys.length - MAX_RECORDS)) {
      store.delete(key)
    }
  }
  await txDone(tx)
}

export async function getAllRecords(): Promise<Omit<HistoryRecord, 'audioBlob'>[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const all = await req(tx.objectStore(STORE_NAME).index('createdAt').getAll()) as HistoryRecord[]
    return all
      .sort((a, b) => b.createdAt - a.createdAt)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ audioBlob, ...rest }) => rest)
  } catch {
    const key = 'voh-fallback'
    return JSON.parse(sessionStorage.getItem(key) ?? '[]')
  }
}

export async function getRecord(id: string): Promise<HistoryRecord | null> {
  try {
    const db = await openDB()
    const result = await req(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id))
    return result ?? null
  } catch {
    return null
  }
}
