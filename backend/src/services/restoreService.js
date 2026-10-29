const path = require("path");
const prisma = require("../lib/prisma");
const {
    validateBackupZip,
    readValidatedBackupZip,
} = require("./backupValidationService");
const { createBackupPackage } = require("./backupService");

const backupDirectory = path.resolve(__dirname, "../../backups");

// Urutan parent lebih dahulu saat memasukkan data.
const INSERT_ORDER = [
    "User",
    "Store",
    "Product",
    "Customer",
    "Supplier",
    "Promotion",
    "Purchase",
    "Order",
    "PromotionItem",
    "PurchaseItem",
    "OrderItem",
    "Payment",
    "PointHistory",
    "Refund",
    "PaymentEvent",
    "Receipt",
    "StockMovement",
    "CashSession",
    "Expense",
];

const DELETE_ORDER = [...INSERT_ORDER].reverse();

const RESET_MODELS = [
    "Refund",
    "PaymentEvent",
    "Receipt",
    "OrderItem",
    "PointHistory",
    "Payment",
    "PurchaseItem",
    "Order",
    "Purchase",
    "StockMovement",
    "CashSession",
    "Expense",
];

function delegateName(model) {
    return model.charAt(0).toLowerCase() + model.slice(1);
}

function normalizeRow(row, model) {
    const result = {};

    for (const field of model.fields) {
        if (field.kind === "object" || !(field.name in row)) continue;

        const value = row[field.name];

        if (value === null) {
            result[field.name] = null;
        } else if (field.type === "DateTime") {
            result[field.name] = new Date(value);
        } else if (field.type === "BigInt") {
            result[field.name] = BigInt(value);
        } else if (field.type === "Bytes") {
            result[field.name] = Buffer.from(value, "base64");
        } else {
            result[field.name] = value;
        }
    }

    return result;
}

async function createVerifiedPreOperationBackup() {
    const backup = await createBackupPackage();
    const backupPath = path.join(backupDirectory, backup.filename);

    // Pastikan backup otomatis dapat dibaca dan lolos validasi.
    const verified = await validateBackupZip(backupPath);

    if (!verified.valid || verified.totalRecords !== backup.totalRecords) {
        throw new Error(
            "Backup pengaman tidak lolos verifikasi. Operasi dibatalkan."
        );
    }

    return backup;
}

async function restoreFromZip(zipPath) {
    // Validasi penuh dilakukan lagi di backend, bukan mengandalkan UI.
    const backupData = await readValidatedBackupZip(zipPath);

    // Backup pengaman harus berhasil sebelum transaksi restore dimulai.
    const safetyBackup = await createVerifiedPreOperationBackup();

    const runtimeModels = prisma._runtimeDataModel.models;
    const expectedModels = Object.keys(runtimeModels).sort();

    if (
        JSON.stringify([...backupData.models].sort()) !==
        JSON.stringify(expectedModels)
    ) {
        throw new Error("Schema backup berubah atau tidak cocok.");
    }

    const result = await prisma.$transaction(
        async (tx) => {
            // Hapus seluruh data dalam urutan yang aman bagi foreign key.
            for (const modelName of DELETE_ORDER) {
                const delegate = tx[delegateName(modelName)];
                await delegate.deleteMany({});
            }

            const restoredCounts = {};

            // Masukkan record parent terlebih dahulu.
            for (const modelName of INSERT_ORDER) {
                const rows = backupData.tables[modelName];
                const model = runtimeModels[modelName];
                const delegate = tx[delegateName(modelName)];

                if (rows.length) {
                    const data = rows.map(row => normalizeRow(row, model));
                    const inserted = await delegate.createMany({ data });

                    if (inserted.count !== rows.length) {
                        throw new Error(
                            `Jumlah restore ${modelName} tidak sesuai.`
                        );
                    }
                }

                restoredCounts[modelName] = rows.length;
            }

            // Periksa kembali jumlah record sebelum commit.
            for (const modelName of INSERT_ORDER) {
                const actual = await tx[delegateName(modelName)].count();
                const expected = backupData.tables[modelName].length;

                if (actual !== expected) {
                    throw new Error(
                        `Verifikasi ${modelName} gagal: ` +
                        `${actual} dari ${expected} record.`
                    );
                }
            }

            return {
                restoredCounts,
                totalRecords: Object.values(restoredCounts)
                    .reduce((sum, count) => sum + count, 0),
            };
        },
        {
            maxWait: 10000,
            timeout: 120000,
        }
    );

    return {
        ...result,
        safetyBackupFilename: safetyBackup.filename,
    };
}

async function resetOperationalData() {
    // Tidak mulai reset sebelum backup pengaman lolos verifikasi.
    const safetyBackup = await createVerifiedPreOperationBackup();

    const result = await prisma.$transaction(
        async (tx) => {
            const deletedCounts = {};

            for (const modelName of RESET_MODELS) {
                const result = await tx[delegateName(modelName)].deleteMany({});
                deletedCounts[modelName] = result.count;
            }

            return {
                deletedCounts,
                totalDeleted: Object.values(deletedCounts)
                    .reduce((sum, count) => sum + count, 0),
            };
        },
        {
            maxWait: 10000,
            timeout: 120000,
        }
    );

    return {
        ...result,
        safetyBackupFilename: safetyBackup.filename,
        preservedModels: [
            "User",
            "Store",
            "Product",
            "Customer",
            "Supplier",
            "Promotion",
            "PromotionItem",
        ],
    };
}

module.exports = { restoreFromZip, resetOperationalData };
