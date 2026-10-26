/** IndexedDB: guarda el identificador de la carpeta de datos entre sesiones (base `trayecto-fs`). */
function idbOp<T = unknown>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) {
  return new Promise<T>((res, rej) => {
    const r = indexedDB.open('trayecto-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const db = r.result,
        tx = db.transaction('kv', mode);
      let rq: IDBRequest;
      try {
        rq = fn(tx.objectStore('kv'));
      } catch (e) {
        db.close();
        rej(e);
        return;
      }
      tx.oncomplete = () => {
        db.close();
        res(rq.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        rej(tx.error);
      };
    };
  });
}
export const idbGet = <T = unknown>(k: string) => idbOp<T>('readonly', (s) => s.get(k)),
  idbSet = (k: string, v: unknown) => idbOp('readwrite', (s) => s.put(v, k)),
  idbDel = (k: string) => idbOp('readwrite', (s) => s.delete(k));
