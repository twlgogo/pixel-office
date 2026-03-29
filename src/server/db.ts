/**
 * 数据库模块
 * 使用 sql.js（纯 JS/WASM，无需编译原生模块）
 */

import initSqlJs, { Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

// 确保 data 目录存在
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pixel-office.db');

let db: Database;

/**
 * 初始化数据库
 */
export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // 如果数据库文件已存在，加载它
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log(`[DB] 数据库已加载: ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`[DB] 新建数据库: ${dbPath}`);
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      last_message TEXT,
      last_active_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )
  `);

  saveDatabase();
  console.log('[DB] 数据库表初始化完成');
}

/**
 * 保存数据库到文件
 */
export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * 获取数据库实例
 */
export function getDb(): Database {
  return db;
}
