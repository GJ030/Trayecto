/** IndexedDB: guarda el identificador de la carpeta de datos. */
/* ---- IndexedDB: guarda el identificador de la carpeta entre sesiones ---- */
function idbOp(mode, fn) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('trayecto-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const db = r.result,
        tx = db.transaction('kv', mode);
      let rq;
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
export const idbGet = (k) => idbOp('readonly', (s) => s.get(k)),
  idbSet = (k, v) => idbOp('readwrite', (s) => s.put(v, k)),
  idbDel = (k) => idbOp('readwrite', (s) => s.delete(k));
