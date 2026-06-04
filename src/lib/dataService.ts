import { 
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, 
  getDocFromServer, onSnapshot, writeBatch, Timestamp 
} from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "../firebase";
import { Product, KnowledgePair, StoreSettings, NetworkStatus, AnalyticsSummary } from "../types";

// Local storage key constants
const PRODUCTS_KEY = "mamo_store_products";
const KB_KEY = "mamo_store_kb";
const SETTINGS_KEY = "mamo_store_settings";
const SYNC_QUEUE_KEY = "mamo_store_sync_queue";
const LOGS_KEY = "mamo_chat_logs";

export interface SyncItem {
  id: string;
  entityType: "product" | "kb" | "settings";
  entityId: string;
  operation: "insert" | "update" | "delete";
  data?: any;
  timestamp: string;
}

type NetworkStatusListener = (status: NetworkStatus) => void;
type DataChangeListener = () => void;

class ConnectionManager {
  private networkStatus: NetworkStatus = "connected";
  private statusListeners: NetworkStatusListener[] = [];
  private changeListeners: DataChangeListener[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.checkConnection());
      window.addEventListener("offline", () => this.setOffline());
      // Initial test
      this.checkConnection();
    }
  }

  public registerStatusListener(listener: NetworkStatusListener) {
    this.statusListeners.push(listener);
    listener(this.networkStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  public registerChangeListener(listener: DataChangeListener) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  public notifyChange() {
    this.changeListeners.forEach(l => l());
  }

  public getStatus(): NetworkStatus {
    return this.networkStatus;
  }

  public setStatus(newStatus: NetworkStatus) {
    if (this.networkStatus !== newStatus) {
      this.networkStatus = newStatus;
      this.statusListeners.forEach(listener => listener(newStatus));
    }
  }

  public async checkConnection() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setOffline();
      return;
    }

    try {
      // Test actual server connection as specified by the Firestore guidelines
      await getDocFromServer(doc(db, "settings", "global"));
      this.setStatus("connected");
      // Trigger sync pass
      SyncService.processSyncQueue();
    } catch (e) {
      // If error message includes 'client is offline' or other network issues, set offline
      this.setStatus("offline");
    }
  }

  private setOffline() {
    this.setStatus("offline");
  }
}

export const connectionManager = new ConnectionManager();

// Detect Electron environment and SQLite IPC exposure
const isElectron = typeof window !== "undefined" && (window as any).electronAPI !== undefined;
const sqliteAPI = isElectron ? (window as any).electronAPI.sqlite : null;

// HELPER: Sync queue functions with SQLite support
const getSyncQueue = async (): Promise<SyncItem[]> => {
  if (sqliteAPI) {
    try {
      const q = await sqliteAPI.getAll("sync_queue");
      return q || [];
    } catch (e) {
      console.warn("SQLite query for sync_queue failed, using localStorage fallback:", e);
    }
  }
  const data = localStorage.getItem(SYNC_QUEUE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveSyncQueue = async (queue: SyncItem[]) => {
  if (sqliteAPI) {
    try {
      await sqliteAPI.saveSyncQueue(queue);
    } catch (e) {
      console.warn("SQLite save for sync_queue failed, using localStorage fallback:", e);
    }
  }
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
};

const pushToSyncQueue = async (item: Omit<SyncItem, "id" | "timestamp">) => {
  const queue = await getSyncQueue();
  const newItem: SyncItem = {
    ...item,
    id: `sync-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
    timestamp: new Date().toISOString()
  };
  queue.push(newItem);
  await saveSyncQueue(queue);
  connectionManager.setStatus("offline");
};

// ==========================================
// 1. PRODUCT SERVICE
// ==========================================
export const ProductService = {
  async getAllProducts(): Promise<Product[]> {
    let localProducts: Product[] = [];
    if (sqliteAPI) {
      try {
        localProducts = await sqliteAPI.getAll("products");
      } catch (e) {
        console.warn("SQLite fetch products failed, reverting to localStorage:", e);
      }
    }
    if (!localProducts || localProducts.length === 0) {
      const localData = localStorage.getItem(PRODUCTS_KEY);
      localProducts = localData ? JSON.parse(localData) : [];
    }

    if (connectionManager.getStatus() === "offline") {
      return localProducts;
    }

    const path = "products";
    try {
      const snapshot = await getDocs(collection(db, "products"));
      const remoteProducts: Product[] = snapshot.docs.map(doc => doc.data() as Product);

      // Bi-directional Last Update Wins (LWW) synchronization
      const mergedProducts: Product[] = [];
      const localMap = new Map(localProducts.map(p => [p.id, p]));
      const remoteMap = new Map(remoteProducts.map(p => [p.id, p]));
      const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
      const activeQueue = await getSyncQueue();

      for (const id of allIds) {
        const localProd = localMap.get(id);
        const remoteProd = remoteMap.get(id);

        if (localProd && remoteProd) {
          const localTime = new Date(localProd.updatedAt || localProd.createdAt || 0).getTime();
          const remoteTime = new Date(remoteProd.updatedAt || remoteProd.createdAt || 0).getTime();

          if (localTime >= remoteTime) {
            mergedProducts.push(localProd);
            // Sync local state back to Firestore asynchronously (LWW)
            setDoc(doc(db, "products", id), localProd).catch(e => {
              console.warn(`Background sync failed for product ${id}:`, e);
            });
          } else {
            mergedProducts.push(remoteProd);
          }
        } else if (localProd) {
          // If only local, let's verify if there is a pending delete queue item. 
          const isDeleted = activeQueue.some(item => item.entityType === "product" && item.entityId === id && item.operation === "delete");
          if (!isDeleted) {
            mergedProducts.push(localProd);
            setDoc(doc(db, "products", id), localProd).catch(e => {
              console.warn(`Background upload failed for product ${id}:`, e);
            });
          }
        } else if (remoteProd) {
          mergedProducts.push(remoteProd);
        }
      }

      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(mergedProducts));
      if (sqliteAPI) {
        for (const prod of mergedProducts) {
          await sqliteAPI.saveRow("products", prod).catch(e => console.warn("Failed SQLite sync product:", e));
        }
      }
      return mergedProducts;
    } catch (error) {
      console.warn("Product fetch from Firestore failed, fallback to local:", error);
      const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
      if (isPermissionErr) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      return localProducts;
    }
  },

  async saveProduct(product: Product): Promise<void> {
    let localProducts: Product[] = [];
    if (sqliteAPI) {
      try {
        localProducts = await sqliteAPI.getAll("products");
      } catch (e) {
        console.warn("SQLite save product fetch failed:", e);
      }
    }
    if (!localProducts || localProducts.length === 0) {
      const localData = localStorage.getItem(PRODUCTS_KEY);
      localProducts = localData ? JSON.parse(localData) : [];
    }
    
    // Set updatedAt to the precise current ISO string
    const updatedProduct = { 
      ...product, 
      createdAt: product.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString() 
    };
    
    const index = localProducts.findIndex(p => p.id === product.id);
    if (index > -1) {
      localProducts[index] = updatedProduct;
    } else {
      localProducts.push(updatedProduct);
    }
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(localProducts));
    
    if (sqliteAPI) {
      await sqliteAPI.saveRow("products", updatedProduct).catch(e => console.warn("SQLite saveRow failed:", e));
    }
    connectionManager.notifyChange();

    const path = `products/${product.id}`;
    if (connectionManager.getStatus() === "connected" && auth.currentUser) {
      try {
        await setDoc(doc(db, "products", product.id), updatedProduct);
      } catch (error) {
        console.warn("Firestore product write failed, logging or queueing offline:", error);
        
        const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
        if (isPermissionErr) {
          handleFirestoreError(error, OperationType.WRITE, path);
        } else {
          await pushToSyncQueue({
            entityType: "product",
            entityId: product.id,
            operation: index > -1 ? "update" : "insert",
            data: updatedProduct
          });
        }
      }
    } else {
      await pushToSyncQueue({
        entityType: "product",
        entityId: product.id,
        operation: index > -1 ? "update" : "insert",
        data: updatedProduct
      });
    }
  },

  async deleteProduct(id: string): Promise<void> {
    let localProducts: Product[] = [];
    if (sqliteAPI) {
      try {
        localProducts = await sqliteAPI.getAll("products");
      } catch (e) {
        console.warn("SQLite delete product fetch failed:", e);
      }
    }
    if (!localProducts || localProducts.length === 0) {
      const localData = localStorage.getItem(PRODUCTS_KEY);
      localProducts = localData ? JSON.parse(localData) : [];
    }
    
    localProducts = localProducts.filter(p => p.id !== id);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(localProducts));
    if (sqliteAPI) {
      await sqliteAPI.deleteRow("products", id).catch(e => console.warn("SQLite deleteRow failed:", e));
    }
    connectionManager.notifyChange();

    const path = `products/${id}`;
    if (connectionManager.getStatus() === "connected" && auth.currentUser) {
      try {
        await deleteDoc(doc(db, "products", id));
      } catch (error) {
        console.warn("Firestore product deletion failed, logging or queueing offline:", error);
        
        const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
        if (isPermissionErr) {
          handleFirestoreError(error, OperationType.DELETE, path);
        } else {
          await pushToSyncQueue({
            entityType: "product",
            entityId: id,
            operation: "delete"
          });
        }
      }
    } else {
      await pushToSyncQueue({
        entityType: "product",
        entityId: id,
        operation: "delete"
      });
    }
  }
};

// ==========================================
// 2. KNOWLEDGE BASE SERVICE
// ==========================================
export const KnowledgeBaseService = {
  async getAllKB(): Promise<KnowledgePair[]> {
    let localKB: KnowledgePair[] = [];
    if (sqliteAPI) {
      try {
        localKB = await sqliteAPI.getAll("knowledge_base");
      } catch (e) {
        console.warn("SQLite fetch KB failed, reverting to localStorage:", e);
      }
    }
    if (!localKB || localKB.length === 0) {
      const localData = localStorage.getItem(KB_KEY);
      localKB = localData ? JSON.parse(localData) : [];
    }

    if (connectionManager.getStatus() === "offline") {
      return localKB;
    }

    const path = "knowledgeBase";
    try {
      const snapshot = await getDocs(collection(db, "knowledgeBase"));
      const remoteKB: KnowledgePair[] = snapshot.docs.map(doc => doc.data() as KnowledgePair);

      // Bi-directional Last Update Wins (LWW) Synchronization
      const mergedKB: KnowledgePair[] = [];
      const localMap = new Map(localKB.map(k => [k.id, k]));
      const remoteMap = new Map(remoteKB.map(k => [k.id, k]));
      const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
      const activeQueue = await getSyncQueue();

      for (const id of allIds) {
        const localPair = localMap.get(id);
        const remotePair = remoteMap.get(id);

        if (localPair && remotePair) {
          const localTime = new Date(localPair.updatedAt || localPair.createdAt || 0).getTime();
          const remoteTime = new Date(remotePair.updatedAt || remotePair.createdAt || 0).getTime();

          if (localTime >= remoteTime) {
            mergedKB.push(localPair);
            setDoc(doc(db, "knowledgeBase", id), localPair).catch(e => {
              console.warn(`Background sync failed for KB ${id}:`, e);
            });
          } else {
            mergedKB.push(remotePair);
          }
        } else if (localPair) {
          const isDeleted = activeQueue.some(item => item.entityType === "kb" && item.entityId === id && item.operation === "delete");
          if (!isDeleted) {
            mergedKB.push(localPair);
            setDoc(doc(db, "knowledgeBase", id), localPair).catch(e => {
              console.warn(`Background upload failed for KB ${id}:`, e);
            });
          }
        } else if (remotePair) {
          mergedKB.push(remotePair);
        }
      }

      localStorage.setItem(KB_KEY, JSON.stringify(mergedKB));
      if (sqliteAPI) {
        for (const pair of mergedKB) {
          await sqliteAPI.saveRow("knowledge_base", pair).catch(e => console.warn("Failed SQLite sync KB:", e));
        }
      }
      return mergedKB;
    } catch (error) {
      console.warn("KB fetch from Firestore failed, fallback to local:", error);
      const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
      if (isPermissionErr) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      return localKB;
    }
  },

  async saveKB(pair: KnowledgePair): Promise<void> {
    let localKB: KnowledgePair[] = [];
    if (sqliteAPI) {
      try {
        localKB = await sqliteAPI.getAll("knowledge_base");
      } catch (e) {
        console.warn("SQLite save KB fetch failed:", e);
      }
    }
    if (!localKB || localKB.length === 0) {
      const localData = localStorage.getItem(KB_KEY);
      localKB = localData ? JSON.parse(localData) : [];
    }

    const updatedPair: KnowledgePair = { 
      ...pair, 
      createdAt: pair.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const index = localKB.findIndex(k => k.id === pair.id);
    if (index > -1) {
      localKB[index] = updatedPair;
    } else {
      localKB.push(updatedPair);
    }
    localStorage.setItem(KB_KEY, JSON.stringify(localKB));
    if (sqliteAPI) {
      await sqliteAPI.saveRow("knowledge_base", updatedPair).catch(e => console.warn("SQLite saveRow KB failed:", e));
    }
    connectionManager.notifyChange();

    const path = `knowledgeBase/${pair.id}`;
    if (connectionManager.getStatus() === "connected" && auth.currentUser) {
      try {
        await setDoc(doc(db, "knowledgeBase", pair.id), updatedPair);
      } catch (error) {
        console.warn("Firestore KB save failed, logging or queueing offline:", error);
        
        const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
        if (isPermissionErr) {
          handleFirestoreError(error, OperationType.WRITE, path);
        } else {
          await pushToSyncQueue({
            entityType: "kb",
            entityId: pair.id,
            operation: index > -1 ? "update" : "insert",
            data: updatedPair
          });
        }
      }
    } else {
      await pushToSyncQueue({
        entityType: "kb",
        entityId: pair.id,
        operation: index > -1 ? "update" : "insert",
        data: updatedPair
      });
    }
  },

  async deleteKB(id: string): Promise<void> {
    let localKB: KnowledgePair[] = [];
    if (sqliteAPI) {
      try {
        localKB = await sqliteAPI.getAll("knowledge_base");
      } catch (e) {
        console.warn("SQLite delete KB fetch failed:", e);
      }
    }
    if (!localKB || localKB.length === 0) {
      const localData = localStorage.getItem(KB_KEY);
      localKB = localData ? JSON.parse(localData) : [];
    }

    localKB = localKB.filter(k => k.id !== id);
    localStorage.setItem(KB_KEY, JSON.stringify(localKB));
    if (sqliteAPI) {
      await sqliteAPI.deleteRow("knowledge_base", id).catch(e => console.warn(e));
    }
    connectionManager.notifyChange();

    const path = `knowledgeBase/${id}`;
    if (connectionManager.getStatus() === "connected" && auth.currentUser) {
      try {
        await deleteDoc(doc(db, "knowledgeBase", id));
      } catch (error) {
        console.warn("Firestore KB deletion failed, logging or queueing offline:", error);
        
        const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
        if (isPermissionErr) {
          handleFirestoreError(error, OperationType.DELETE, path);
        } else {
          await pushToSyncQueue({
            entityType: "kb",
            entityId: id,
            operation: "delete"
          });
        }
      }
    } else {
      await pushToSyncQueue({
        entityType: "kb",
        entityId: id,
        operation: "delete"
      });
    }
  }
};

// ==========================================
// 3. SETTINGS SERVICE
// ==========================================
export const SettingsService = {
  async getSettings(): Promise<StoreSettings | null> {
    let localSettings: StoreSettings | null = null;
    if (sqliteAPI) {
      try {
        localSettings = await sqliteAPI.getSettings();
      } catch (e) {
        console.warn("SQLite getSettings failed:", e);
      }
    }
    if (!localSettings) {
      const localData = localStorage.getItem(SETTINGS_KEY);
      localSettings = localData ? JSON.parse(localData) : null;
    }

    if (connectionManager.getStatus() === "offline") {
      return localSettings;
    }

    const path = "settings/global";
    try {
      const docSnapshot = await getDoc(doc(db, "settings", "global"));
      if (docSnapshot.exists()) {
        const remoteSettings = docSnapshot.data() as StoreSettings;
        
        // Settings LWW Check
        if (localSettings) {
          const localTime = new Date(localSettings.updatedAt || 0).getTime();
          const remoteTime = new Date(remoteSettings.updatedAt || 0).getTime();

          if (localTime >= remoteTime) {
            setDoc(doc(db, "settings", "global"), localSettings).catch(e => {
              console.warn("Background setDoc failed for settings:", e);
            });
            return localSettings;
          }
        }
        
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(remoteSettings));
        if (sqliteAPI) {
          await sqliteAPI.saveSettings(remoteSettings).catch(e => console.warn(e));
        }
        return remoteSettings;
      } else if (localSettings) {
        // Upload local settings if remote doesn't exist yet
        setDoc(doc(db, "settings", "global"), localSettings).catch(e => {
          console.warn("Background upload failed for local settings:", e);
        });
      }
      return localSettings;
    } catch (error) {
      console.warn("Settings fetch from Firestore failed, fallback to local:", error);
      const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
      if (isPermissionErr) {
        handleFirestoreError(error, OperationType.GET, path);
      }
      return localSettings;
    }
  },

  async saveSettings(settings: StoreSettings): Promise<void> {
    const updatedSettings = {
      ...settings,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
    if (sqliteAPI) {
      await sqliteAPI.saveSettings(updatedSettings).catch(e => console.warn(e));
    }
    connectionManager.notifyChange();

    const path = "settings/global";
    if (connectionManager.getStatus() === "connected" && auth.currentUser) {
      try {
        await setDoc(doc(db, "settings", "global"), updatedSettings);
      } catch (error) {
        console.warn("Firestore settings save failed, logging or queueing offline:", error);
        
        const isPermissionErr = error instanceof Error && (error.message.includes("permission") || error.message.includes("Permission"));
        if (isPermissionErr) {
          handleFirestoreError(error, OperationType.WRITE, path);
        } else {
          await pushToSyncQueue({
            entityType: "settings",
            entityId: "global",
            operation: "update",
            data: updatedSettings
          });
        }
      }
    } else {
      await pushToSyncQueue({
        entityType: "settings",
        entityId: "global",
        operation: "update",
        data: updatedSettings
      });
    }
  }
};

// ==========================================
// 4. CHAT LOG SERVICE
// ==========================================
export const ChatLogService = {
  async logChatToBackend(question: string, answer: string, source: string): Promise<void> {
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const logData = {
      id,
      question,
      answer,
      source,
      createdAt: new Date().toISOString()
    };

    // Keep cached locally or post to analytics
    const localLogs = localStorage.getItem(LOGS_KEY);
    const list = localLogs ? JSON.parse(localLogs) : [];
    list.unshift(logData);
    localStorage.setItem(LOGS_KEY, JSON.stringify(list.slice(0, 50)));

    if (sqliteAPI) {
      await sqliteAPI.saveRow("chat_logs", logData).catch(e => console.warn(e));
    }

    // Save to Firestore collections `chat_logs` directly
    try {
      await setDoc(doc(db, "chat_logs", id), logData);
    } catch (error) {
      console.warn("Couldn't save chat log directly to Firestore:", error);
    }
  }
};

// ==========================================
// 5. AUTO SYNCHRONIZATION ENGINE
// ==========================================
export const SyncService = {
  isSyncing: false,

  async processSyncQueue() {
    if (this.isSyncing) return;
    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    this.isSyncing = true;
    connectionManager.setStatus("syncing");

    try {
      for (const item of queue) {
        let ref;
        if (item.entityType === "product") {
          ref = doc(db, "products", item.entityId);
        } else if (item.entityType === "kb") {
          ref = doc(db, "knowledgeBase", item.entityId);
        } else {
          ref = doc(db, "settings", "global");
        }

        if (item.operation === "delete") {
          try {
            await deleteDoc(ref);
          } catch (deleteError) {
            console.warn(`Sync deletion failed for ${item.entityId}:`, deleteError);
          }
        } else {
          // Compare updatedAt times (Last Update Wins)
          try {
            const currentDoc = await getDoc(ref);
            if (currentDoc.exists()) {
              const remoteData = currentDoc.data() as any;
              const remoteUpdatedAt = remoteData?.updatedAt || remoteData?.createdAt || "";
              const localUpdatedAt = item.data?.updatedAt || item.data?.createdAt || "";

              if (remoteUpdatedAt && localUpdatedAt && new Date(remoteUpdatedAt) > new Date(localUpdatedAt)) {
                // Remote is NEWER, conflict resolution rule says Remote Wins in this case
                console.log(`Conflict resolved: Remote version of ${item.entityId} wins over local.`);
                continue; // Skip writing this obsolete queue item to cloud
              }
            }
          } catch (e) {
            console.warn("Could not retrieve remote document during conflict resolution, overriding with local:", e);
          }

          // Write local copy to Firestore
          try {
            await setDoc(ref, item.data);
          } catch (writeError) {
            console.warn(`Sync write failed for ${item.entityId}:`, writeError);
          }
        }
      }

      // Success, empty the queue
      await saveSyncQueue([]);
      connectionManager.setStatus("connected");
      connectionManager.notifyChange();
      console.log("Offline state synchronized flawlessly!");
    } catch (error) {
      console.error("Synchronization loop failed:", error);
      connectionManager.setStatus("offline");
    } finally {
      this.isSyncing = false;
    }
  }
};

// ==========================================
// 6. DATABASE RESET SERVICE
// ==========================================
export const DatabaseResetService = {
  async resetAllData(clearCloud: boolean = true): Promise<void> {
    // 1. Clear LocalStorage keys
    localStorage.removeItem("mamo_store_products");
    localStorage.removeItem("mamo_store_kb");
    localStorage.removeItem("mamo_store_sync_queue");
    localStorage.removeItem("mamo_chat_logs");

    const defaultSettings: StoreSettings = {
      storeName: "شركة مامو - الرقة",
      logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300",
      welcomeMessage: "أهلاً ومرحباً بكم في شركة مامو - الرقة! نسعد بخدمتكم وتوفير كافة طلباتكم من المواد والسلع المتميزة. ما الذي تبحث عنه اليوم بالصالة؟",
      phone: "+33 6 60 16 79 48",
      whatsApp: "+33 6 60 16 79 48",
      address: "الرقة - صالة العرض الكبرى بجوار دوار الدلة",
      geminiAPIKey: ""
    };
    localStorage.setItem("mamo_store_settings", JSON.stringify(defaultSettings));

    // SQLite resets
    if (sqliteAPI) {
      try {
        await sqliteAPI.clearTable("products");
        await sqliteAPI.clearTable("knowledge_base");
        await sqliteAPI.clearTable("sync_queue");
        await sqliteAPI.clearTable("chat_logs");
        await sqliteAPI.saveSettings(defaultSettings);
      } catch (e) {
        console.warn("SQLite database tables reset failed:", e);
      }
    }

    // 2. Clear Firestore if online
    if (clearCloud && connectionManager.getStatus() === "connected") {
      try {
        // Reset settings
        await setDoc(doc(db, "settings", "global"), defaultSettings);

        // Truncate products collection
        const prodSnap = await getDocs(collection(db, "products"));
        for (const d of prodSnap.docs) {
          await deleteDoc(doc(db, "products", d.id));
        }

        // Truncate knowledgeBase collection
        const kbSnap = await getDocs(collection(db, "knowledgeBase"));
        for (const d of kbSnap.docs) {
          await deleteDoc(doc(db, "knowledgeBase", d.id));
        }

        // Truncate chat_logs collection
        const logSnap = await getDocs(collection(db, "chat_logs"));
        for (const d of logSnap.docs) {
          await deleteDoc(doc(db, "chat_logs", d.id));
        }
      } catch (error) {
        console.error("Firestore cloud database reset failed:", error);
      }
    }

    // Trigger local state updates across components
    connectionManager.notifyChange();
  }
};
