import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const DB_NAME = 'wc-inbox-v1'
const DB_VERSION = 1
const LIST_CACHE_ID = '__inbox_list__'

export type OfflineConversation = { id: string } & Record<string, unknown>

export type OfflineMessage = { id: string; conversation_id: string } & Record<string, unknown>

export type OutgoingMessage = {
  client_id: string
  conversation_id: string
  content: string
  options?: Record<string, unknown>
  queued_at?: string
}

type ConversationListCache = {
  id: typeof LIST_CACHE_ID
  updatedAt: string
  rows: Array<Record<string, unknown> & { id: string }>
}

interface InboxOfflineDb extends DBSchema {
  conversations: {
    key: string
    value: (Record<string, unknown> & { id: string }) | ConversationListCache
  }
  messages: {
    key: string
    value: OfflineMessage
    indexes: { conversation_id: string }
  }
  outbox: {
    key: string
    value: OutgoingMessage & { queued_at: string }
  }
}

let dbPromise: Promise<IDBPDatabase<InboxOfflineDb>> | null = null
let openDb: IDBPDatabase<InboxOfflineDb> | null = null

/** Reset cached DB handle — used by tests after deleting the database. */
export async function __resetOfflineStoreForTests() {
  const pending = dbPromise
  dbPromise = null
  try {
    if (openDb) {
      openDb.close()
      openDb = null
    } else if (pending) {
      const db = await pending
      db.close()
    }
  } catch {
    // ignore close errors in tests
  }
}

function getDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = openDB<InboxOfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('conversations')) {
            db.createObjectStore('conversations', { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains('messages')) {
            const messages = db.createObjectStore('messages', { keyPath: 'id' })
            messages.createIndex('conversation_id', 'conversation_id')
          }
          if (!db.objectStoreNames.contains('outbox')) {
            db.createObjectStore('outbox', { keyPath: 'client_id' })
          }
        }
      },
    }).then((db) => {
      openDb = db
      return db
    })
  }
  return dbPromise
}

export async function saveConversation(c: Record<string, unknown> & { id: string }) {
  if (!c?.id) throw new Error('Conversation id required')
  try {
    const db = await getDb()
    await db.put('conversations', c)
  } catch {
    // IndexedDB may be unavailable in jsdom / private mode — soft-fail
  }
}

export async function saveMessages(list: OfflineMessage[]) {
  if (!Array.isArray(list) || list.length === 0) return
  try {
    const db = await getDb()
    const tx = db.transaction('messages', 'readwrite')
    await Promise.all(list.map((msg) => tx.store.put(msg)))
    await tx.done
  } catch {
    // soft-fail when IndexedDB is unavailable
  }
}

export async function getConversation(
  id: string,
): Promise<(Record<string, unknown> & { id: string }) | undefined> {
  try {
    const db = await getDb()
    const row = await db.get('conversations', id)
    if (!row || row.id === LIST_CACHE_ID) return undefined
    return row as Record<string, unknown> & { id: string }
  } catch {
    return undefined
  }
}

export async function getMessages(
  conversationId: string,
  limit = 100,
): Promise<OfflineMessage[]> {
  try {
    const db = await getDb()
    const rows = await db.getAllFromIndex('messages', 'conversation_id', conversationId)
    const sorted = rows.sort((a, b) => {
      const aAt = String(a.created_at || a.queued_at || '')
      const bAt = String(b.created_at || b.queued_at || '')
      return aAt.localeCompare(bAt)
    })
    if (limit > 0 && sorted.length > limit) {
      return sorted.slice(sorted.length - limit)
    }
    return sorted
  } catch {
    return []
  }
}

export async function enqueueOutgoing(msg: OutgoingMessage) {
  const clientId =
    msg.client_id || `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry: OutgoingMessage & { queued_at: string } = {
    ...msg,
    client_id: clientId,
    queued_at: msg.queued_at || new Date().toISOString(),
  }
  try {
    const db = await getDb()
    await db.put('outbox', entry)
  } catch {
    // soft-fail when IndexedDB is unavailable
  }
  return entry
}

export type FlushSendFn = (msg: OutgoingMessage & { queued_at: string }) => Promise<void>

export async function flushOutbox(sendFn: FlushSendFn): Promise<{ sent: number; failed: number }> {
  try {
    const db = await getDb()
    const pending = await db.getAll('outbox')
    let sent = 0
    let failed = 0
    const ordered = pending.sort((a, b) => a.queued_at.localeCompare(b.queued_at))
    for (const entry of ordered) {
      try {
        await sendFn(entry)
        await db.delete('outbox', entry.client_id)
        sent += 1
      } catch {
        failed += 1
      }
    }
    return { sent, failed }
  } catch {
    return { sent: 0, failed: 0 }
  }
}

export async function saveConversationList(rows: Array<Record<string, unknown> & { id: string }>) {
  try {
    const db = await getDb()
    const tx = db.transaction('conversations', 'readwrite')
    await tx.store.put({
      id: LIST_CACHE_ID,
      updatedAt: new Date().toISOString(),
      rows,
    })
    for (const row of rows) {
      if (row?.id) await tx.store.put(row)
    }
    await tx.done
  } catch {
    // soft-fail when IndexedDB is unavailable (jsdom mounts, private mode)
  }
}

export async function getConversationList<
  T extends Record<string, unknown> & { id: string } = Record<string, unknown> & { id: string },
>(): Promise<T[] | null> {
  try {
    const db = await getDb()
    const cached = await db.get('conversations', LIST_CACHE_ID)
    if (cached && 'rows' in cached && Array.isArray(cached.rows)) {
      return cached.rows as T[]
    }
    return null
  } catch {
    return null
  }
}

export async function listOutbox(): Promise<Array<OutgoingMessage & { queued_at: string }>> {
  try {
    const db = await getDb()
    return await db.getAll('outbox')
  } catch {
    return []
  }
}

/** Open a future DB version for upgrade-path tests without losing stores. */
export async function openInboxDbAtVersion(version: number) {
  return openDB(DB_NAME, version, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('messages')) {
          const messages = db.createObjectStore('messages', { keyPath: 'id' })
          messages.createIndex('conversation_id', 'conversation_id')
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'client_id' })
        }
      }
      if (oldVersion < 2 && version >= 2) {
        // Future bump placeholder — keep existing stores intact.
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'id' })
        }
      }
    },
  })
}
