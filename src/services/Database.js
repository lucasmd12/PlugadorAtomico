import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

SQLite.enablePromise(true);

let db = null;

// Abre (ou cria) o banco local. Chamado uma vez na inicialização do app.
export async function initDatabase() {
  db = await SQLite.openDatabase({ name: 'plugador.db', location: 'default' });
  await createTables();
  return db;
}

async function createTables() {
  await db.executeSql(`
    -- Perfil local do usuário e do contato
    -- Cada campo de foto armazena o path local do arquivo no celular
    CREATE TABLE IF NOT EXISTS profile (
      id              INTEGER PRIMARY KEY,
      my_name         TEXT    DEFAULT 'Eu',
      my_avatar_path  TEXT,              -- minha foto de perfil (exibida no mapa e no chat)
      my_wallpaper_path TEXT,            -- meu papel de parede do chat
      contact_phone   TEXT,             -- número do outro celular
      contact_name    TEXT    DEFAULT 'Contato',
      contact_avatar_path TEXT,         -- foto de perfil que EU defino pra visualizar o contato
      contact_wallpaper_path TEXT       -- papel de parede que EU defino pro fundo do chat
    );
  `);

  await db.executeSql(`
    -- Todas as mensagens da conversa, enviadas e recebidas
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT    PRIMARY KEY,   -- UUID gerado localmente
      type        TEXT    NOT NULL,      -- MSG | VOZ | GPS | IMG
      direction   TEXT    NOT NULL,      -- sent | received
      payload     TEXT,                 -- texto ou base64 (voz/imagem)
      lat         REAL,                 -- só para tipo GPS
      lng         REAL,                 -- só para tipo GPS
      status      TEXT    DEFAULT 'sending', -- sending | sent | received | read | error
      created_at  INTEGER NOT NULL,     -- timestamp Unix em ms
      read_at     INTEGER               -- quando foi lido (null até ser lido)
    );
  `);

  await db.executeSql(`
    -- Chunks de mensagens fragmentadas (voz longa, imagem de perfil via SMS)
    -- Quando todos os chunks de um id chegarem, a mensagem é remontada
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
    -- Histórico de localizações recebidas e enviadas
    CREATE TABLE IF NOT EXISTS locations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      direction   TEXT    NOT NULL,   -- sent | received
      lat         REAL    NOT NULL,
      lng         REAL    NOT NULL,
      created_at  INTEGER NOT NULL
    );
  `);

  // Garante que existe exatamente uma linha de perfil
  await db.executeSql(`
    INSERT OR IGNORE INTO profile (id) VALUES (1);
  `);
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
  await db.executeSql(
    `UPDATE messages SET status = ? WHERE id = ?`,
    [status, id]
  );
}

export async function markMessageRead(id) {
  await db.executeSql(
    `UPDATE messages SET status = 'read', read_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
}

// Retorna todas as mensagens ordenadas por data — o histórico completo do chat
export async function getAllMessages() {
  const [result] = await db.executeSql(
    `SELECT * FROM messages ORDER BY created_at ASC`
  );
  return rowsToArray(result);
}

// ─── CHUNKS ───────────────────────────────────────────────────────────────────

export async function saveChunk({ messageId, seq, total, data }) {
  await db.executeSql(
    `INSERT OR IGNORE INTO chunks (message_id, seq, total, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [messageId, seq, total, data, Date.now()]
  );
}

// Verifica se todos os chunks de uma mensagem já chegaram e retorna o payload
// remontado na ordem correta. Retorna null se ainda falta algum chunk.
export async function tryReassemble(messageId) {
  const [result] = await db.executeSql(
    `SELECT * FROM chunks WHERE message_id = ? ORDER BY seq ASC`,
    [messageId]
  );
  const chunks = rowsToArray(result);
  if (chunks.length === 0) return null;

  const total = chunks[0].total;
  if (chunks.length < total) return null; // ainda aguardando partes

  // Remonta concatenando os dados de cada chunk em ordem
  const reassembled = chunks.map(c => c.data).join('');

  // Limpa os chunks usados para não acumular dados no banco
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

// Retorna o histórico completo de trilha — útil para replay de movimento
export async function getLocationHistory(direction = 'received', limit = 500) {
  const [result] = await db.executeSql(
    `SELECT * FROM locations WHERE direction = ?
     ORDER BY created_at DESC LIMIT ?`,
    [direction, limit]
  );
  return rowsToArray(result);
}

// ─── PERFIL ───────────────────────────────────────────────────────────────────

export async function getProfile() {
  const [result] = await db.executeSql(`SELECT * FROM profile WHERE id = 1`);
  return result.rows.item(0);
}

export async function updateProfile(fields) {
  const keys   = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.executeSql(
    `UPDATE profile SET ${setClause} WHERE id = 1`,
    values
  );
}

// Salva uma imagem da galeria no armazenamento permanente do app e
// atualiza o campo correspondente no perfil.
// field: 'my_avatar_path' | 'my_wallpaper_path' |
//        'contact_avatar_path' | 'contact_wallpaper_path'
export async function saveProfileImage(field, sourceUri) {
  const filename = `${field}_${Date.now()}.jpg`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

  await RNFS.copyFile(sourceUri, destPath);
  await updateProfile({ [field]: destPath });
  return destPath;
}

// ─── UTILITÁRIO ───────────────────────────────────────────────────────────────

function rowsToArray(result) {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
}
