// tests/utils/db-helpers.js
export async function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CRM_Database', 6);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve();
                return;
            }
            const tx = db.transaction(storeName, 'readwrite');
            const clearRequest = tx.objectStore(storeName).clear();
            clearRequest.onsuccess = () => {
                db.close();
                resolve();
            };
            clearRequest.onerror = (e) => {
                db.close();
                reject(e.target.error);
            };
        };
        request.onerror = (e) => reject(request.error);
    });
}