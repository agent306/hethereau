/**
 * Local-first IndexedDB storage (Paimon.moe pattern: zero backend account needed).
 * Supports multiple NTE profiles/accounts + full JSON backup & restore.
 */

const DB_NAME = 'hethereau_moe_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const STATE_KEY = 'account_state_v1';

const DEFAULT_STATE = {
  activeProfileId: 'main',
  profiles: {
    main: {
      id: 'main',
      name: 'Main Account',
      region: 'Global',
      uid: '',
      updatedAt: null,
      records: [],
    },
  },
};

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAppState() {
  try {
    const db = await openDb();
    if (!db) return structuredClone(DEFAULT_STATE);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => {
        const val = req.result;
        if (val && val.profiles && val.activeProfileId && val.profiles[val.activeProfileId]) {
          resolve(val);
        } else {
          resolve(structuredClone(DEFAULT_STATE));
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export async function saveAppState(state) {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(state, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to persist state to IndexedDB:', err);
  }
}

export function buildBackupJson(state) {
  return JSON.stringify(
    {
      format: 'hethereau-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      state,
    },
    null,
    2
  );
}

export function parseBackupJson(text) {
  const parsed = JSON.parse(text);
  if (parsed?.format !== 'hethereau-backup' || !parsed?.state?.profiles) {
    throw new Error('Not a valid Hethereau backup file.');
  }
  return parsed.state;
}
