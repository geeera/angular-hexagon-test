import {Injectable} from '@angular/core';
import {BehaviorSubject, map, Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class IndexDB {
  private _db$ = new BehaviorSubject<IDBDatabase | null>(null);
  db$ = this._db$.asObservable();

  constructor() {
    if (!this._db$) {
      this.openDB().then(db => {
        this._db$.next(db);
      }).catch(error => {
        console.error('Connected with DB was failed:', error);
      })
    }
  }

  openDB() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('h3CacheDB', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cells')) {
          db.createObjectStore('cells'); // key: string, value: string[]
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getFromDB$(key: string): Observable<any | undefined> {
    return this.db$.pipe(
      map((db) => {
        if (db instanceof IDBDatabase) {
          const tx = db.transaction('cells', 'readonly');
          const store = tx.objectStore('cells');
          const req = store.get(key);
          // req.onsuccess = () => next(req.result);
          req.onerror = () => {
            if (req.error) {
              throw new Error(req.error as any);
            }
          };
          return req.result
        }
      })
    );
  }

  setToDB$(key: string, value: any) {
    return this.db$.pipe(
      map((db) => {
        if (db instanceof IDBDatabase) {
          const tx = db.transaction('cells', 'readwrite');
          const store = tx.objectStore('cells');
          store.put(value, key);
          tx.onerror = () => {
            if (tx.error) {
              throw new Error(tx.error as any);
            }
          };
          return tx;
        }
        return null;
      })
    );
  }

  closeDB() {
    this._db$.next(null);
    this._db$.complete();
  }
}
