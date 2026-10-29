const fs = require("fs/promises");
const fsSync = require("fs");
const archiver = require("archiver");
const path = require("path");
const prisma = require("../lib/prisma");

const backupDirectory = path.resolve(__dirname, "../../backups");
const backupFormatVersion = 1;

async function createBackup() {
    await fs.mkdir(backupDirectory, { recursive: true });

    // Baca semua model dalam satu snapshot transaksi yang konsisten.
    const snapshot = await prisma.$transaction(
        async (tx) => {
            const models = tx._runtimeDataModel.models;
            const tables = {};
            const counts = {};

            for (const modelName of Object.keys(models)) {
                const delegateName =
                    modelName.charAt(0).toLowerCase() + modelName.slice(1);

                const delegate = tx[delegateName];

                if (!delegate || typeof delegate.findMany !== "function") {
                    throw new Error(
                        `Model ${modelName} tidak memiliki delegate Prisma yang valid`
                    );
                }

                const rows = await delegate.findMany();
                tables[modelName] = rows;
                counts[modelName] = rows.length;
            }

            return {
                models: Object.keys(models),
                tables,
                counts,
            };
        },
        {
            isolationLevel: "RepeatableRead",
            maxWait: 10000,
            timeout: 120000,
        }
    );

    const createdAt = new Date().toISOString();
    const filename =
        `smartpos-backup-${createdAt.replace(/[:.]/g, "-")}.json`;

    const backup = {
        application: "SmartPOS",
        formatVersion: backupFormatVersion,
        createdAt,
        models: snapshot.models,
        counts: snapshot.counts,
        tables: snapshot.tables,
    };

    const filePath = path.join(backupDirectory, filename);
    const temporaryPath = `${filePath}.tmp`;

    try {
        await fs.writeFile(
            temporaryPath,
            JSON.stringify(backup, null, 2),
            { flag: "wx", mode: 0o600 }
        );

        await fs.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
    }

    const stats = await fs.stat(filePath);

    return {
        filename,
        createdAt,
        sizeBytes: stats.size,
        counts: snapshot.counts,
        totalRecords: Object.values(snapshot.counts).reduce(
            (total, count) => total + count,
            0
        ),
    };
}


async function createBackupPackage() {
    await fs.mkdir(backupDirectory, { recursive: true });

    // Database JSON adalah satu-satunya sumber data untuk proses restore.
    const backupInfo = await createBackup();
    const jsonPath = path.join(backupDirectory, backupInfo.filename);
    const backup = JSON.parse(await fs.readFile(jsonPath, "utf8"));

    const createdAt = new Date().toISOString();
    const stamp = createdAt.replace(/[:.]/g, "-");
    const filename = `smartpos-backup-package-${stamp}.zip`;
    const zipPath = path.join(backupDirectory, filename);
    const temporaryPath = `${zipPath}.tmp`;

    const manifest = {
        application: "SmartPOS",
        packageFormatVersion: 1,
        backupFormatVersion: backup.formatVersion,
        createdAt,
        databaseFile: "database.json",
        restoreSource: "database.json",
        models: backup.models,
        counts: backup.counts,
        totalRecords: backupInfo.totalRecords,
    };

    try {
        await new Promise((resolve, reject) => {
            const output = fsSync.createWriteStream(temporaryPath, {
                flags: "wx",
                mode: 0o600,
            });
            const archive = new archiver.ZipArchive({
                zlib: { level: 6 },
            });

            let settled = false;
            const fail = (error) => {
                if (settled) return;
                settled = true;
                reject(error);
            };

            output.on("close", () => {
                if (settled) return;
                settled = true;
                resolve();
            });
            output.on("error", fail);
            archive.on("error", fail);

            archive.pipe(output);
            archive.append(JSON.stringify(backup, null, 2), {
                name: "database.json",
            });
            archive.append(JSON.stringify(manifest, null, 2), {
                name: "manifest.json",
            });

            Promise.resolve(archive.finalize()).catch(fail);
        });

        await fs.rename(temporaryPath, zipPath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
    }

    const stats = await fs.stat(zipPath);

    return {
        filename,
        createdAt,
        sizeBytes: stats.size,
        counts: backup.counts,
        totalRecords: backupInfo.totalRecords,
        files: ["database.json", "manifest.json"],
    };
}

module.exports = { createBackup, createBackupPackage };
