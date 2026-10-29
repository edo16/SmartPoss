const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { validateBackupZip } = require("../services/backupValidationService");
const { createBackup, createBackupPackage } = require("../services/backupService");
const { restoreFromZip, resetOperationalData } = require("../services/restoreService");

const backupDirectory = path.resolve(__dirname, "../../backups");

async function create(req, res) {
    try {
        const result = await createBackup();

        return res.status(201).json({
            success: true,
            message: "Backup database berhasil dibuat.",
            data: result,
        });
    } catch (error) {
        console.error("BACKUP CREATE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Gagal membuat backup database.",
        });
    }
}

async function download(req, res) {
    try {
        const { filename } = req.params;

        if (
            typeof filename !== "string" ||
            !/^smartpos-backup-[\w.-]+\.json$/.test(filename) ||
            path.basename(filename) !== filename
        ) {
            return res.status(400).json({
                success: false,
                message: "Nama file backup tidak valid.",
            });
        }

        const filePath = path.join(backupDirectory, filename);
        const content = await fs.readFile(filePath, "utf8");

        let backup;

        try {
            backup = JSON.parse(content);
        } catch {
            return res.status(422).json({
                success: false,
                message: "File backup tidak berisi JSON yang valid.",
            });
        }

        if (
            backup.application !== "SmartPOS" ||
            backup.formatVersion !== 1 ||
            !backup.tables ||
            !Array.isArray(backup.models)
        ) {
            return res.status(422).json({
                success: false,
                message: "Format file bukan backup SmartPOS yang didukung.",
            });
        }

        return res.download(filePath, filename);
    } catch (error) {
        if (error.code === "ENOENT") {
            return res.status(404).json({
                success: false,
                message: "File backup tidak ditemukan.",
            });
        }

        console.error("BACKUP DOWNLOAD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Gagal mengunduh file backup.",
        });
    }
}


async function createPackage(req, res) {
    try {
        const result = await createBackupPackage();

        return res.status(201).json({
            success: true,
            message: "Paket backup ZIP berhasil dibuat.",
            data: result,
        });
    } catch (error) {
        console.error("BACKUP PACKAGE CREATE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Gagal membuat paket backup ZIP.",
        });
    }
}

async function downloadPackage(req, res) {
    try {
        const { filename } = req.params;

        if (
            typeof filename !== "string" ||
            !/^smartpos-backup-package-[\w.-]+\.zip$/.test(filename) ||
            path.basename(filename) !== filename
        ) {
            return res.status(400).json({
                success: false,
                message: "Nama file paket backup tidak valid.",
            });
        }

        const filePath = path.join(backupDirectory, filename);
        await fs.access(filePath);

        return res.download(filePath, filename);
    } catch (error) {
        if (error.code === "ENOENT") {
            return res.status(404).json({
                success: false,
                message: "Paket backup ZIP tidak ditemukan.",
            });
        }

        console.error("BACKUP PACKAGE DOWNLOAD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Gagal mengunduh paket backup ZIP.",
        });
    }
}


async function validatePackageUpload(req, res) {
    let temporaryPath;

    try {
        const buffer = req.body;

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Pilih file ZIP terlebih dahulu.",
            });
        }

        const maxBytes = 50 * 1024 * 1024;
        if (buffer.length > maxBytes) {
            return res.status(413).json({
                success: false,
                message: "Ukuran ZIP maksimal 50 MB.",
            });
        }

        // File sementara privat, nama acak, dan tidak memakai nama dari pengguna.
        temporaryPath = path.join(
            os.tmpdir(),
            `smartpos-upload-${crypto.randomUUID()}.zip`
        );

        await fs.writeFile(temporaryPath, buffer, {
            flag: "wx",
            mode: 0o600,
        });

        const validation = await validateBackupZip(temporaryPath);

        return res.status(200).json({
            success: true,
            message: "ZIP valid dan siap ditinjau. Belum ada data yang dipulihkan.",
            data: validation,
        });
    } catch (error) {
        if (error.code === "BACKUP_VALIDATION_FAILED") {
            return res.status(422).json({
                success: false,
                message: error.message,
            });
        }

        console.error("BACKUP ZIP VALIDATION ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Gagal memvalidasi ZIP.",
        });
    } finally {
        if (temporaryPath) {
            await fs.rm(temporaryPath, { force: true }).catch(() => {});
        }
    }
}


async function restorePackageUpload(req, res) {
    let temporaryPath;

    try {
        const buffer = req.body;

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Pilih file ZIP terlebih dahulu.",
            });
        }

        if (buffer.length > 50 * 1024 * 1024) {
            return res.status(413).json({
                success: false,
                message: "Ukuran ZIP maksimal 50 MB.",
            });
        }

        temporaryPath = path.join(
            os.tmpdir(),
            `smartpos-restore-${crypto.randomUUID()}.zip`
        );

        await fs.writeFile(temporaryPath, buffer, {
            flag: "wx",
            mode: 0o600,
        });

        const result = await restoreFromZip(temporaryPath);

        return res.status(200).json({
            success: true,
            message: "Pemulihan database berhasil dan jumlah record telah diverifikasi.",
            data: result,
        });
    } catch (error) {
        if (error.code === "BACKUP_VALIDATION_FAILED") {
            return res.status(422).json({
                success: false,
                message: error.message,
            });
        }

        console.error("BACKUP RESTORE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message ||
                "Pemulihan gagal. Periksa log backend dan backup pengaman.",
        });
    } finally {
        if (temporaryPath) {
            await fs.rm(temporaryPath, { force: true }).catch(() => {});
        }
    }
}

async function resetOperational(req, res) {
    try {
        if (req.body?.confirmation !== "RESET DATA OPERASIONAL") {
            return res.status(400).json({
                success: false,
                message: 'Konfirmasi harus persis "RESET DATA OPERASIONAL".',
            });
        }

        const result = await resetOperationalData();

        return res.status(200).json({
            success: true,
            message: "Reset data operasional berhasil.",
            data: result,
        });
    } catch (error) {
        console.error("BACKUP RESET ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Reset data operasional gagal.",
        });
    }
}

module.exports = { create, download, createPackage, downloadPackage, validatePackageUpload , restorePackageUpload, resetOperational };
