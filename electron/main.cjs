const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let db = null;
let useFallbackDb = false;
let fallbackDbPath = '';

// Dynamically try to import sqlite3
function initDatabase() {
  const userDirPath = app.getPath('userData');
  const dbFile = path.join(userDirPath, 'mamo.sqlite');
  fallbackDbPath = path.join(userDirPath, 'mamo_fallback_db.json');

  try {
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite. Switching to JSON fallback:', err);
        setupFallbackDb();
      } else {
        console.log('Connected to SQLite database successfully at', dbFile);
        createTables();
      }
    });
  } catch (error) {
    console.warn('sqlite3 native module is not available (common in non-packaged envs). Using fallback JSON database:', error.message);
    setupFallbackDb();
  }
}

// Fallback JSON-based store when native sqlite3 is missing
function setupFallbackDb() {
  useFallbackDb = true;
  if (!fs.existsSync(fallbackDbPath)) {
    fs.writeFileSync(fallbackDbPath, JSON.stringify({
      products: [],
      knowledge_base: [],
      settings: {},
      sync_queue: [],
      chat_logs: []
    }, null, 2), 'utf8');
  }
}

function getFallbackData() {
  try {
    const raw = fs.readFileSync(fallbackDbPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { products: [], knowledge_base: [], settings: {}, sync_queue: [], chat_logs: [] };
  }
}

function saveFallbackData(data) {
  try {
    fs.writeFileSync(fallbackDbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write JSON fallback db:', e);
  }
}

function createTables() {
  db.serialize(() => {
    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      priceUSD REAL,
      priceSYR REAL,
      unit TEXT,
      stock INTEGER,
      imageUrl TEXT,
      notes TEXT,
      isAvailable INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    )`);

    // Knowledge Base table
    db.run(`CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      question TEXT,
      answer TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )`);

    // Settings table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    // Sync queue table
    db.run(`CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entityType TEXT,
      entityId TEXT,
      operation TEXT,
      data TEXT,
      timestamp TEXT
    )`);

    // Chat logs table
    db.run(`CREATE TABLE IF NOT EXISTS chat_logs (
      id TEXT PRIMARY KEY,
      question TEXT,
      answer TEXT,
      source TEXT,
      createdAt TEXT
    )`);
  });
}

// Register SQLite IPC triggers
function registerIpcHandlers() {
  // GET ALL
  ipcMain.handle('sqlite-get-all', async (event, table) => {
    if (useFallbackDb) {
      const data = getFallbackData();
      if (table === 'products') return data.products;
      if (table === 'knowledge_base') return data.knowledge_base;
      if (table === 'sync_queue') return data.sync_queue;
      if (table === 'chat_logs') return data.chat_logs;
      return [];
    }

    return new Promise((resolve) => {
      let actualTable = table;
      if (table === 'knowledgeBase') actualTable = 'knowledge_base';
      
      db.all(`SELECT * FROM ${actualTable}`, [], (err, rows) => {
        if (err) {
          console.error(`Error querying ${actualTable}:`, err);
          resolve([]);
        } else {
          // Parse boolean integers or JSON strings if any
          const mapped = rows.map(r => {
            if (r.data) {
              try { r.data = JSON.parse(r.data); } catch(_) {}
            }
            if (r.isAvailable !== undefined) {
              r.isAvailable = r.isAvailable === 1;
            }
            return r;
          });
          resolve(mapped);
        }
      });
    });
  });

  // GET ONE (Settings specialty)
  ipcMain.handle('sqlite-get-settings', async () => {
    if (useFallbackDb) {
      const data = getFallbackData();
      return data.settings || {};
    }

    return new Promise((resolve) => {
      db.get(`SELECT value FROM settings WHERE key = 'global'`, [], (err, row) => {
        if (err || !row) {
          resolve(null);
        } else {
          try {
            resolve(JSON.parse(row.value));
          } catch (e) {
            resolve(null);
          }
        }
      });
    });
  });

  // SAVE ONE SETTINGS
  ipcMain.handle('sqlite-save-settings', async (event, value) => {
    if (useFallbackDb) {
      const data = getFallbackData();
      data.settings = value;
      saveFallbackData(data);
      return;
    }

    return new Promise((resolve) => {
      db.run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('global', ?)`,
        [JSON.stringify(value)],
        (err) => {
          if (err) console.error('Error saving settings:', err);
          resolve();
        }
      );
    });
  });

  // SAVE ONE (Product/KB/Queue Item/Log)
  ipcMain.handle('sqlite-save-row', async (event, { table, data }) => {
    if (useFallbackDb) {
      const dataStore = getFallbackData();
      if (table === 'products') {
        dataStore.products = dataStore.products.filter(p => p.id !== data.id);
        dataStore.products.push(data);
      } else if (table === 'knowledge_base') {
        dataStore.knowledge_base = dataStore.knowledge_base.filter(k => k.id !== data.id);
        dataStore.knowledge_base.push(data);
      } else if (table === 'sync_queue') {
        dataStore.sync_queue = dataStore.sync_queue.filter(q => q.id !== data.id);
        dataStore.sync_queue.push(data);
      } else if (table === 'chat_logs') {
        dataStore.chat_logs = dataStore.chat_logs.filter(l => l.id !== data.id);
        dataStore.chat_logs.unshift(data);
      }
      saveFallbackData(dataStore);
      return;
    }

    return new Promise((resolve) => {
      if (table === 'products') {
        db.run(
          `INSERT OR REPLACE INTO products (id, name, category, priceUSD, priceSYR, unit, stock, imageUrl, notes, isAvailable, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.id, data.name, data.category, data.priceUSD, data.priceSYR,
            data.unit, data.stock, data.imageUrl, data.notes, data.isAvailable ? 1 : 0,
            data.createdAt, data.updatedAt
          ],
          (err) => {
            if (err) console.error('Error replacing product:', err);
            resolve();
          }
        );
      } else if (table === 'knowledge_base') {
        db.run(
          `INSERT OR REPLACE INTO knowledge_base (id, question, answer, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
          [data.id, data.question, data.answer, data.createdAt, data.updatedAt],
          (err) => {
            if (err) console.error('Error replacing KB:', err);
            resolve();
          }
        );
      } else if (table === 'sync_queue') {
        db.run(
          `INSERT OR REPLACE INTO sync_queue (id, entityType, entityId, operation, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
          [data.id, data.entityType, data.entityId, data.operation, JSON.stringify(data.data || {}), data.timestamp],
          (err) => {
            if (err) console.error('Error replacing sync item:', err);
            resolve();
          }
        );
      } else if (table === 'chat_logs') {
        db.run(
          `INSERT OR REPLACE INTO chat_logs (id, question, answer, source, createdAt) VALUES (?, ?, ?, ?, ?)`,
          [data.id, data.question, data.answer, data.source, data.createdAt],
          (err) => {
            if (err) console.error('Error replacing chat log:', err);
            resolve();
          }
        );
      } else {
        resolve();
      }
    });
  });

  // DELETE ONE
  ipcMain.handle('sqlite-delete-row', async (event, { table, id }) => {
    if (useFallbackDb) {
      const dataStore = getFallbackData();
      if (table === 'products') dataStore.products = dataStore.products.filter(p => p.id !== id);
      if (table === 'knowledge_base') dataStore.knowledge_base = dataStore.knowledge_base.filter(k => k.id !== id);
      if (table === 'sync_queue') dataStore.sync_queue = dataStore.sync_queue.filter(q => q.id !== id);
      saveFallbackData(dataStore);
      return;
    }

    return new Promise((resolve) => {
      let actualTable = table;
      if (table === 'knowledge_base' || table === 'knowledgeBase') actualTable = 'knowledge_base';
      db.run(`DELETE FROM ${actualTable} WHERE id = ?`, [id], (err) => {
        if (err) console.error(`Error deleting from ${actualTable}:`, err);
        resolve();
      });
    });
  });

  // BULK SAVE SYNC QUEUE
  ipcMain.handle('sqlite-save-sync-queue', async (event, queue) => {
    if (useFallbackDb) {
      const dataStore = getFallbackData();
      dataStore.sync_queue = queue;
      saveFallbackData(dataStore);
      return;
    }

    return new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM sync_queue', [], (err) => {
          if (err) console.error('Error clearing sync_queue:', err);
          
          if (queue.length === 0) {
            resolve();
            return;
          }

          const stmt = db.prepare('INSERT INTO sync_queue (id, entityType, entityId, operation, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
          queue.forEach(item => {
            stmt.run([item.id, item.entityType, item.entityId, item.operation, JSON.stringify(item.data || {}), item.timestamp]);
          });
          stmt.finalize(() => {
            resolve();
          });
        });
      });
    });
  });

  // CLEAR TABLE
  ipcMain.handle('sqlite-clear-table', async (event, table) => {
    if (useFallbackDb) {
      const dataStore = getFallbackData();
      if (table === 'products') dataStore.products = [];
      if (table === 'knowledge_base') dataStore.knowledge_base = [];
      if (table === 'sync_queue') dataStore.sync_queue = [];
      if (table === 'chat_logs') dataStore.chat_logs = [];
      saveFallbackData(dataStore);
      return;
    }

    return new Promise((resolve) => {
      let actualTable = table;
      if (table === 'knowledgeBase') actualTable = 'knowledge_base';
      db.run(`DELETE FROM ${actualTable}`, [], (err) => {
        if (err) console.error(`Error clearing ${actualTable}:`, err);
        resolve();
      });
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "متجر مامو - بوابة الإدارة",
    frame: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Hides native system menu bar for sleek modern feel
  mainWindow.setMenuBarVisibility(false);

  // In production, load the built react files.
  // In development, load localhost dev server
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});
