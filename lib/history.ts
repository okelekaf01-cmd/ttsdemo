import type { HistoryRecord } from '@/types'
import { encryptRecord, decryptRecord, type StoredRecord } from '@/lib/crypto.client'

const DB_NAME = 'voiceover-history'
const STORE_NAME = 'records'
const DB_VERSION = 2
const MAX_RECORDS = 20

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('createdAt', 'createdAt', { unique: false })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbReq<T>(r: IDBRequest<T>): Promise<T> {
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
    const slim = {
      id: record.id,
      createdAt: record.createdAt,
      chineseText: record.chineseText,
      englishText: record.englishText,
    }
    sessionStorage.setItem(key, JSON.stringify([slim, ...existing].slice(0, MAX_RECORDS)))
    return
  }

  const stored = await encryptRecord(record)
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await idbReq(store.put(stored))

  const allKeys = await idbReq(store.index('createdAt').getAllKeys())
  if (allKeys.length > MAX_RECORDS) {
    for (const k of allKeys.slice(0, allKeys.length - MAX_RECORDS)) {
      store.delete(k)
    }
  }
  await txDone(tx)
}

export async function getAllRecords(): Promise<Omit<HistoryRecord, 'audioBlob'>[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const all = (await idbReq(
      tx.objectStore(STORE_NAME).index('createdAt').getAll()
    )) as StoredRecord[]

    const decrypted = await Promise.all(all.map(decryptRecord))
    return decrypted
      .filter((r): r is HistoryRecord => r !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ audioBlob, ...rest }) => rest)
  } catch {
    const key = 'voh-fallback'
    return JSON.parse(sessionStorage.getItem(key) ?? '[]')
  }
}

export async function deleteRecord(id: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    await txDone(tx)
  } catch {
    const key = 'voh-fallback'
    const existing = JSON.parse(sessionStorage.getItem(key) ?? '[]')
    sessionStorage.setItem(
      key,
      JSON.stringify(existing.filter((r: { id: string }) => r.id !== id))
    )
  }
}

export async function getRecord(id: string): Promise<HistoryRecord | null> {
  try {
    const db = await openDB()
    const stored = (await idbReq(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    )) as StoredRecord | undefined
    if (!stored) return null
    return decryptRecord(stored)
  } catch {
    return null
  }
}
