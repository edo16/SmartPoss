const fs = require("fs/promises");
const path = require("path");
const unzipper = require("unzipper");
const prisma = require("../lib/prisma");

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_JSON_BYTES = 100 * 1024 * 1024;
const EXPECTED_FILES = ["database.json", "manifest.json"];
const schemaPath = path.resolve(__dirname, "../../prisma/schema.prisma");
const schemaText = require("fs").readFileSync(schemaPath, "utf8");
const enumValues = {};

for (const match of schemaText.matchAll(
  /^enum\s+(\w+)\s*\{([^}]*)\}/gm
)) {
  enumValues[match[1]] = match[2]
    .split("\n")
    .map(line => line.trim())
    .filter(line => /^[A-Za-z_][A-Za-z0-9_]*$/.test(line));
}

function reject(message) {
  const error = new Error(message);
  error.code = "BACKUP_VALIDATION_FAILED";
  throw error;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validScalar(value, field) {
  if (value === null) return !field.isRequired;

  if (field.kind === "enum") {
    const values = enumValues[field.type];
    return Array.isArray(values) && values.includes(value);
  }

  if (field.kind !== "scalar") return false;

  switch (field.type) {
    case "String": return typeof value === "string";
    case "Boolean": return typeof value === "boolean";
    case "Int": return Number.isInteger(value);
    case "Float": return typeof value === "number" && Number.isFinite(value);
    case "Decimal":
      return (typeof value === "string" || typeof value === "number") &&
        String(value).trim() !== "" && Number.isFinite(Number(value));
    case "BigInt": return typeof value === "string" && /^-?\d+$/.test(value);
    case "DateTime":
      return typeof value === "string" && value.length > 0 &&
        Number.isFinite(Date.parse(value));
    case "Json": return true;
    case "Bytes": return typeof value === "string";
    default: return false;
  }
}

function validateBackupData(backup) {
  if (!isObject(backup) || backup.application !== "SmartPOS" ||
      backup.formatVersion !== 1) {
    reject("Format database backup tidak didukung.");
  }

  const runtimeModels = prisma._runtimeDataModel.models;
  const expectedModels = Object.keys(runtimeModels).sort();

  if (!Array.isArray(backup.models) || !isObject(backup.tables)) {
    reject("Daftar model atau tabel backup tidak valid.");
  }

  if (
    JSON.stringify([...backup.models].sort()) !== JSON.stringify(expectedModels) ||
    JSON.stringify(Object.keys(backup.tables).sort()) !== JSON.stringify(expectedModels)
  ) {
    reject("Daftar model backup tidak cocok dengan schema saat ini.");
  }

  const records = {};
  const ids = {};
  const counts = {};

  for (const modelName of expectedModels) {
    const model = runtimeModels[modelName];
    const rows = backup.tables[modelName];

    if (!Array.isArray(rows)) reject(`${modelName}: tabel bukan array.`);

    records[modelName] = rows;
    counts[modelName] = rows.length;
    ids[modelName] = new Set();

    for (const row of rows) {
      if (!isObject(row)) reject(`${modelName}: record bukan object.`);

      const scalarFields = model.fields.filter(f => f.kind !== "object");
      const allowed = new Set(scalarFields.map(f => f.name));

      for (const key of Object.keys(row)) {
        if (!allowed.has(key)) reject(`${modelName}: field tidak dikenal ${key}.`);
      }

      for (const field of scalarFields) {
        if (!(field.name in row)) {
          if (field.isRequired && !field.isUpdatedAt) {
            reject(`${modelName}.${field.name}: field wajib tidak ada.`);
          }
          continue;
        }

        if (!validScalar(row[field.name], field)) {
          reject(`${modelName}.${field.name}: tipe/nilai tidak valid.`);
        }
      }

      const idField = model.fields.find(f => f.isId);
      if (idField) {
        const id = row[idField.name];
        if (typeof id !== "string" || !id) {
          reject(`${modelName}: ID tidak valid.`);
        }
        if (ids[modelName].has(id)) reject(`${modelName}: ID duplikat ${id}.`);
        ids[modelName].add(id);
      }
    }
  }

  // Validasi foreign key dari metadata relasi Prisma.
  for (const modelName of expectedModels) {
    const model = runtimeModels[modelName];

    for (const relation of model.fields) {
      if (relation.kind !== "object" ||
          !relation.relationFromFields?.length) continue;

      const targetRows = records[relation.type];
      if (!targetRows) reject(`${modelName}: model relasi tidak ditemukan.`);

      for (const row of records[modelName]) {
        for (let i = 0; i < relation.relationFromFields.length; i++) {
          const from = relation.relationFromFields[i];
          const to = relation.relationToFields[i];
          const value = row[from];

          if (value === null || value === undefined) continue;

          if (!targetRows.some(target => target[to] === value)) {
            reject(`${modelName}.${from}: foreign key tidak ditemukan.`);
          }
        }
      }
    }
  }

  if (backup.counts !== undefined) {
    for (const modelName of expectedModels) {
      if (backup.counts[modelName] !== counts[modelName]) {
        reject(`${modelName}: jumlah record berbeda dari metadata.`);
      }
    }
  }

  return {
    modelCount: expectedModels.length,
    counts,
    totalRecords: Object.values(counts).reduce((sum, n) => sum + n, 0),
  };
}

async function readJsonEntry(directory, name) {
  const entries = directory.files.filter(entry => entry.path === name);

  if (entries.length !== 1 || entries[0].type === "Directory") {
    reject(`ZIP harus berisi tepat satu ${name}.`);
  }

  const entry = entries[0];
  if (entry.uncompressedSize > MAX_JSON_BYTES) {
    reject(`${name} terlalu besar.`);
  }

  let buffer;
  try {
    buffer = await entry.buffer();
  } catch {
    reject(`${name} gagal dibaca.`);
  }

  if (buffer.length > MAX_JSON_BYTES) reject(`${name} terlalu besar.`);

  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    reject(`${name} bukan JSON yang valid.`);
  }
}

async function validateBackupZip(zipPath) {
  const resolvedPath = path.resolve(zipPath);
  const stats = await fs.stat(resolvedPath);

  if (!stats.isFile() || stats.size > MAX_ZIP_BYTES) {
    reject("File ZIP tidak valid atau terlalu besar.");
  }

  let directory;

  try {
    directory = await unzipper.Open.file(resolvedPath);
  } catch {
    reject("File bukan ZIP yang valid atau arsip ZIP rusak.");
  }
  const fileNames = directory.files
    .filter(entry => entry.type !== "Directory")
    .map(entry => entry.path);

  if (fileNames.length !== EXPECTED_FILES.length ||
      EXPECTED_FILES.some(name => fileNames.filter(n => n === name).length !== 1)) {
    reject("ZIP hanya boleh berisi database.json dan manifest.json.");
  }

  const [manifest, backup] = await Promise.all([
    readJsonEntry(directory, "manifest.json"),
    readJsonEntry(directory, "database.json"),
  ]);

  if (!isObject(manifest) ||
      manifest.application !== "SmartPOS" ||
      manifest.packageFormatVersion !== 1 ||
      manifest.backupFormatVersion !== 1 ||
      manifest.databaseFile !== "database.json") {
    reject("Manifest backup tidak valid atau tidak didukung.");
  }

  const result = validateBackupData(backup);

  if (!Array.isArray(manifest.models) ||
      JSON.stringify([...manifest.models].sort()) !==
      JSON.stringify([...backup.models].sort())) {
    reject("Daftar model pada manifest dan database berbeda.");
  }

  if (manifest.totalRecords !== result.totalRecords) {
    reject("Total record pada manifest tidak cocok.");
  }

  return {
    valid: true,
    createdAt: backup.createdAt,
    ...result,
  };
}

async function readValidatedBackupZip(zipPath) {
  // Jangan pernah mengembalikan data sebelum seluruh ZIP tervalidasi.
  await validateBackupZip(zipPath);

  const directory = await unzipper.Open.file(path.resolve(zipPath));
  return readJsonEntry(directory, "database.json");
}

module.exports = { validateBackupZip, readValidatedBackupZip };
