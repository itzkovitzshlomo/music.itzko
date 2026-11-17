import { Project } from '../types/daw';

const DB_NAME = 'harmonia_daw_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectToDb(project: Project): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readwrite');
    tx.objectStore(STORE_PROJECTS).put({ ...project, updatedAt: Date.now() });
    tx.objectStore(STORE_META).put(project.id, 'lastProjectId');
  } catch {
    // Fallback silently if IndexedDB is restricted
  }
}

export async function listProjectsFromDb(): Promise<Project[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).getAll();
      req.onsuccess = () => {
        const list = (req.result as Project[]) || [];
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function loadLastProjectFromDb(): Promise<Project | null> {
  try {
    const db = await openDb();
    const lastId = await new Promise<string | undefined>((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('lastProjectId');
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => resolve(undefined);
    });
    if (!lastId) return null;
    return await new Promise<Project | null>((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).get(lastId);
      req.onsuccess = () => resolve((req.result as Project) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteProjectFromDb(projectId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(projectId);
  } catch {
    // ignore
  }
}
