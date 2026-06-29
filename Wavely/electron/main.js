const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const initSqlJs = require('sql.js')

const isDev = !app.isPackaged
let db
let dbPath
let mainWin = null

// ---- 起動進捗 ----

const startupLog = []
let startupReady = false

function recordStep(id, label) {
  startupLog.push({ id, label })
  if (mainWin && !mainWin.isDestroyed()) {
    try { mainWin.webContents.send('startup-progress', { id, label }) } catch (_) {}
  }
}

// ---- Config (DB保存先など永続設定) ----

let configPath
let config = {}

function loadConfig() {
  configPath = path.join(app.getPath('userData'), 'config.json')
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    }
  } catch (_) { config = {} }
}

function saveConfig() {
  try { fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8') } catch (_) {}
}

// ---- DB helpers ----

function saveDb() {
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function queryAll(sql, params) {
  const stmt = db.prepare(sql)
  if (params && params.length) stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function queryOne(sql, params) {
  const stmt = db.prepare(sql)
  if (params && params.length) stmt.bind(params)
  let row = null
  if (stmt.step()) row = stmt.getAsObject()
  stmt.free()
  return row
}

function execute(sql, params) {
  db.run(sql, params || [])
  saveDb()
}

function lastId() {
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]
}

// ---- Database initialization ----

async function initDatabase() {
  recordStep('wasm', 'データベースエンジンを準備中')
  const SQL = await initSqlJs()

  recordStep('db', 'データベースを開いています')
  const defaultDbPath = path.join(app.getPath('userData'), 'turbo.db')
  dbPath = (config.dbPath && fs.existsSync(config.dbPath)) ? config.dbPath : defaultDbPath

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath))
  } else {
    db = new SQL.Database()
  }
  db.run('PRAGMA foreign_keys = ON')

  recordStep('schema', 'スキーマを確認中')

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#6366f1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    start_date TEXT,
    end_date TEXT,
    progress INTEGER DEFAULT 0,
    comment TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
  try { db.run(`ALTER TABLE tasks ADD COLUMN comment TEXT DEFAULT ''`) } catch(_) {}
  try { db.run(`ALTER TABLE tasks ADD COLUMN parent_id INTEGER`) } catch(_) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN sort_order INTEGER DEFAULT 0`) } catch(_) {}
  try { db.run(`ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0`) } catch(_) {}
  try { db.run(`ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0`) } catch(_) {}

  const row = queryOne('SELECT COUNT(*) as count FROM projects')
  if (!row || row.count === 0) {
    db.run('INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
      ['サンプルプロジェクト', 'デフォルトプロジェクト', '#6366f1'])
    const projectId = lastId()

    const today = new Date()
    const relDate = (offset) => {
      const d = new Date(today)
      d.setDate(d.getDate() + offset)
      return d.toISOString().split('T')[0]
    }

    const tasks = [
      ['要件定義', 'done', 'high', relDate(-14), relDate(-8), 100],
      ['設計', 'done', 'high', relDate(-7), relDate(-3), 100],
      ['フロントエンド実装', 'in_progress', 'medium', relDate(-2), relDate(10), 40],
      ['バックエンド実装', 'todo', 'medium', relDate(3), relDate(14), 0],
      ['テスト', 'todo', 'low', relDate(15), relDate(20), 0],
    ]

    for (const [title, status, priority, start_date, end_date, progress] of tasks) {
      db.run(
        'INSERT INTO tasks (project_id, title, status, priority, start_date, end_date, progress) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [projectId, title, status, priority, start_date, end_date, progress]
      )
    }
  }

  saveDb()
}

// ---- IPC Handlers ----

const TASK_SELECT = `
  SELECT t.*, p.name as project_name, p.color as project_color
  FROM tasks t
  LEFT JOIN projects p ON t.project_id = p.id
`

function setupIpcHandlers() {
  ipcMain.handle('get-projects', () =>
    queryAll('SELECT * FROM projects WHERE (archived = 0 OR archived IS NULL) ORDER BY sort_order ASC, created_at ASC')
  )

  ipcMain.handle('get-archived-projects', () =>
    queryAll('SELECT * FROM projects WHERE archived = 1 ORDER BY sort_order ASC, created_at ASC')
  )

  ipcMain.handle('archive-project', (_, id) => {
    execute('UPDATE projects SET archived = 1 WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('unarchive-project', (_, id) => {
    execute('UPDATE projects SET archived = 0 WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('create-project', (_, { name, description, color }) => {
    const maxRow = queryOne('SELECT MAX(sort_order) as max FROM projects WHERE (archived = 0 OR archived IS NULL)')
    const nextOrder = (maxRow?.max ?? -1) + 1
    db.run('INSERT INTO projects (name, description, color, sort_order) VALUES (?, ?, ?, ?)',
      [name, description || '', color || '#6366f1', nextOrder])
    const id = lastId()
    saveDb()
    return queryOne('SELECT * FROM projects WHERE id = ?', [id])
  })

  ipcMain.handle('update-project', (_, { id, name, description, color }) => {
    execute('UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ?',
      [name, description || '', color, id])
    return queryOne('SELECT * FROM projects WHERE id = ?', [id])
  })

  ipcMain.handle('delete-project', (_, id) => {
    execute('DELETE FROM projects WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('get-tasks', (_, projectId, includeArchived) => {
    const sql = TASK_SELECT +
      (projectId
        ? 'WHERE t.project_id = ? ORDER BY t.sort_order ASC, t.created_at ASC'
        : includeArchived
          ? 'ORDER BY t.sort_order ASC, t.created_at ASC'
          : 'WHERE (p.archived = 0 OR p.archived IS NULL) ORDER BY t.sort_order ASC, t.created_at ASC')
    return queryAll(sql, projectId ? [projectId] : [])
  })

  ipcMain.handle('reorder-projects', (_, ids) => {
    ids.forEach((id, index) => db.run('UPDATE projects SET sort_order = ? WHERE id = ?', [index, id]))
    saveDb()
    return { success: true }
  })

  ipcMain.handle('reorder-tasks', (_, ids) => {
    ids.forEach((id, index) => db.run('UPDATE tasks SET sort_order = ? WHERE id = ?', [index, id]))
    saveDb()
    return { success: true }
  })

  ipcMain.handle('create-task', (_, task) => {
    db.run(`
      INSERT INTO tasks (project_id, title, description, status, priority, start_date, end_date, progress, comment, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      task.project_id, task.title, task.description || '',
      task.status || 'todo', task.priority || 'medium',
      task.start_date || null, task.end_date || null, task.progress || 0,
      task.comment || '', task.parent_id || null,
    ])
    const id = lastId()
    saveDb()
    return queryOne(`${TASK_SELECT} WHERE t.id = ?`, [id])
  })

  ipcMain.handle('update-task', (_, task) => {
    execute(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        start_date = ?, end_date = ?, progress = ?, comment = ?, project_id = ?,
        parent_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      task.title, task.description || '', task.status, task.priority,
      task.start_date || null, task.end_date || null, task.progress || 0,
      task.comment || '', task.project_id, task.parent_id || null, task.id,
    ])
    return queryOne(`${TASK_SELECT} WHERE t.id = ?`, [task.id])
  })

  ipcMain.handle('delete-task', (_, id) => {
    execute('DELETE FROM tasks WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('get-db-path', () => dbPath)

  ipcMain.handle('choose-db-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'データベースの保存先フォルダを選択',
      buttonLabel: 'この場所に保存',
    })
    if (result.canceled || !result.filePaths.length) return null

    const newDbPath = path.join(result.filePaths[0], 'turbo.db')
    if (newDbPath === dbPath) return dbPath

    const oldDbPath = dbPath
    const data = db.export()
    fs.writeFileSync(newDbPath, Buffer.from(data))
    try { fs.unlinkSync(oldDbPath) } catch (_) {}

    dbPath = newDbPath
    config.dbPath = newDbPath
    saveConfig()

    return newDbPath
  })
}

// ---- Window ----

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  mainWin.once('ready-to-show', () => mainWin.show())

  if (isDev) {
    mainWin.loadURL('http://localhost:5173')
  } else {
    mainWin.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ---- App lifecycle ----

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  loadConfig()

  // レンダラーが起動ログを追いかけられるよう、ウィンドウより先に登録
  ipcMain.handle('get-startup-state', () => ({
    steps: startupLog,
    ready: startupReady,
  }))

  // ウィンドウをすぐに表示してローディング画面を見せる
  createWindow()

  // DB 初期化（各フェーズで進捗を送信）
  await initDatabase()

  // データハンドラーをDB初期化後に登録
  setupIpcHandlers()

  startupReady = true
  recordStep('ready', '起動完了')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (db) db.close()
  if (process.platform !== 'darwin') app.quit()
})
