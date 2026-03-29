import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

SQLite.enablePromise(true);

let db = null;

export async function initDatabase() {
  db = await SQLite.openDatabase({ name: 'plugador.db', location: 'default' });
  await createTables();
  return db;
}

async function createTables() {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS profile (
      id                    INTEGER PRIMARY KEY,
      my_name               TEXT    DEFAULT 'Eu',
      my_avatar_path        TEXT,
      my_wallpaper_path     TEXT,
      contact_phone         TEXT,
      contact_name          TEXT    DEFAULT 'Contato',
      contact_avatar_path   TEXT,
      contact_wallpaper_path TEXT
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT    PRIMARY KEY,
      type        TEXT    NOT NULL,
      direction   TEXT    NOT NULL,
      payload     TEXT,
      lat         REAL,
      lng         REAL,
      status      TEXT    DEFAULT 'sending',
      created_at  INTEGER NOT NULL,
      read_at     INTEGER
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS chunks (
      message_id  TEXT    NOT NULL,
      seq         INTEGER NOT NULL,
      total       INTEGER NOT NULL,
      data        TEXT    NOT NULL,
      created_at  INTEGER NOT NULL,
      PRIMARY KEY (message_id, seq)
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS locations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      direction   TEXT    NOT NULL,
      lat         REAL    NOT NULL,
      lng         REAL    NOT NULL,
      created_at  INTEGER NOT NULL
    );
  `);

  await db.executeSql(`INSERT OR IGNORE INTO profile (id) VALUES (1);`);
}

// ─── PERFIL ───────────────────────────────────────────────────────────────────

export async function getProfile() {
  const [result] = await db.executeSql(`SELECT * FROM profile WHERE id = 1`);
  return result.rows.item(0);
}

export async function updateProfile(fields) {
  const keys      = Object.keys(fields);
  const values    = Object.values(fields);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.executeSql(`UPDATE profile SET ${setClause} WHERE id = 1`, values);
}

// Salva o número configurado — persiste entre sessões
export async function saveContactPhone(phone) {
  await updateProfile({ contact_phone: phone });
}

// Recupera o número salvo — usado no App.jsx ao iniciar
export async function getSavedContactPhone() {
  const profile = await getProfile();
  return profile?.contact_phone ?? null;
}

export async function saveProfileImage(field, sourceUri) {
  const filename = `${field}_${Date.now()}.jpg`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

  // Trata URI content:// do Xiaomi e outros Android modernos
  const cleanUri = sourceUri.startsWith('content://')
    ? sourceUri
    : sourceUri.replace('file://', '');

  await RNFS.copyFile(cleanUri, destPath);
  await updateProfile({ [field]: destPath });
  return destPath;
}

// ─── MENSAGENS ────────────────────────────────────────────────────────────────

export async function saveMessage({ id, type, direction, payload, lat, lng, status }) {
  await db.executeSql(
    `INSERT OR REPLACE INTO messages
       (id, type, direction, payload, lat, lng, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, type, direction, payload ?? null, lat ?? null, lng ?? null, status, Date.now()]
  );
}

export async function updateMessageStatus(id, status) {
  await db.executeSql(`UPDATE messages SET status = ? WHERE id = ?`, [status, id]);
}

export async function markMessageRead(id) {
  await db.executeSql(
    `UPDATE messages SET status = 'read', read_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
}

export async function getAllMessages() {
  const [result] = await db.executeSql(
    `SELECT * FROM messages ORDER BY created_at ASC`
  );
  return rowsToArray(result);
}

// ─── CHUNKS ───────────────────────────────────────────────────────────────────

export async function saveChunk({ messageId, seq, total, data }) {
  await db.executeSql(
    `INSERT OR IGNORE INTO chunks (message_id, seq, total, data, created_at) VALUES (?, ?, ?, ?, ?)`,
    [messageId, seq, total, data, Date.now()]
  );
}

export async function tryReassemble(messageId) {
  const [result] = await db.executeSql(
    `SELECT * FROM chunks WHERE message_id = ? ORDER BY seq ASC`, [messageId]
  );
  const chunks = rowsToArray(result);
  if (chunks.length === 0) return null;
  const total = chunks[0].total;
  if (chunks.length < total) return null;
  const reassembled = chunks.map(c => c.data).join('');
  await db.executeSql(`DELETE FROM chunks WHERE message_id = ?`, [messageId]);
  return reassembled;
}

// ─── LOCALIZAÇÃO ──────────────────────────────────────────────────────────────

export async function saveLocation({ direction, lat, lng }) {
  await db.executeSql(
    `INSERT INTO locations (direction, lat, lng, created_at) VALUES (?, ?, ?, ?)`,
    [direction, lat, lng, Date.now()]
  );
}

export async function getLocationHistory(direction = 'received', limit = 500) {
  const [result] = await db.executeSql(
    `SELECT * FROM locations WHERE direction = ? ORDER BY created_at DESC LIMIT ?`,
    [direction, limit]
  );
  return rowsToArray(result);
}

// ─── UTILITÁRIO ───────────────────────────────────────────────────────────────

function rowsToArray(result) {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}
