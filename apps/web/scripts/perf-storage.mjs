/**
 * Stockage sur l'appareil (docs/PERF.md), lu dans une page ouverte de l'app :
 * localStorage par clé (UTF-16 : 2 octets par caractère, quota ≈ 5 M
 * caractères), bases IndexedDB (cache Firestore : magasins et taille des
 * enregistrements), Cache Storage (entrées et octets par cache),
 * navigator.storage.estimate().
 */
export const kb = (n) => `${(n / 1024).toFixed(1)} Kio`;
export const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} Mio`;

export async function deviceStorage(page) {
  return page.evaluate(async () => {
    const local = Object.keys(localStorage)
      .map((key) => ({ key, chars: key.length + (localStorage.getItem(key) ?? '').length }))
      .sort((a, b) => b.chars - a.chars);
    const caches_ = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      let bytes = 0;
      const reqs = await cache.keys();
      for (const req of reqs) bytes += (await (await cache.match(req)).blob()).size;
      caches_.push({ name, entries: reqs.length, bytes });
    }
    const idb = [];
    for (const info of (await indexedDB.databases?.()) ?? []) {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(info.name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const stores = [];
      for (const name of db.objectStoreNames) {
        const all = await new Promise((res) => {
          const r = db.transaction(name).objectStore(name).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => res([]);
        });
        let chars = 0;
        for (const v of all) {
          try {
            chars += JSON.stringify(v, (_k, x) => (x instanceof ArrayBuffer || ArrayBuffer.isView(x) ? `<${x.byteLength}>`.padEnd(x.byteLength) : x)).length;
          } catch {
            /* valeur non sérialisable */
          }
        }
        stores.push({ name, records: all.length, approxBytes: chars });
      }
      db.close();
      idb.push({ name: info.name, stores: stores.filter((s) => s.records > 0).sort((a, b) => b.approxBytes - a.approxBytes) });
    }
    const est = await navigator.storage.estimate();
    return { local, caches: caches_, idb, estimate: { usage: est.usage, quota: est.quota, details: est.usageDetails ?? null } };
  });
}

export function printStorage(s) {
  console.log('\n== Stockage sur l’appareil ==');
  const total = s.local.reduce((n, k) => n + k.chars, 0);
  console.log(`  localStorage : ${s.local.length} clés, ${total} caractères ≈ ${kb(total * 2)} (UTF-16)`);
  for (const k of s.local) console.log(`    ${k.key.padEnd(34)} ${String(k.chars).padStart(8)} car.`);
  for (const c of s.caches) console.log(`  Cache Storage « ${c.name} » : ${c.entries} entrées, ${mb(c.bytes)}`);
  for (const db of s.idb) {
    const sum = db.stores.reduce((n, st) => n + st.approxBytes, 0);
    console.log(`  IndexedDB « ${db.name} » : ≈ ${kb(sum)} (${db.stores.map((st) => `${st.name} ${st.records}`).join(', ')})`);
  }
  console.log(`  navigator.storage.estimate : ${mb(s.estimate.usage)} utilisés / quota ${mb(s.estimate.quota)} ${JSON.stringify(s.estimate.details ?? {})}`);
}
