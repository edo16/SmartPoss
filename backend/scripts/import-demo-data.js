require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum diatur di file .env");
}

const TARGET_URL = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: TARGET_URL
  })
});

const DATE_FIELDS = {
  store: ["createdAt", "updatedAt"],
  user: ["createdAt", "updatedAt"],
  product: ["createdAt", "updatedAt"],
  customer: ["createdAt", "updatedAt"],
  pointHistory: ["createdAt"],
  supplier: ["createdAt", "updatedAt"],
  purchase: ["createdAt", "updatedAt"],
  order: ["createdAt", "updatedAt"],
  payment: ["expiresAt", "paidAt", "createdAt", "updatedAt"],
  paymentEvent: ["processedAt", "createdAt"],
  receipt: ["printedAt", "createdAt"],
  stockMovement: ["createdAt"],
  cashSession: ["openedAt", "closedAt"],
  promotion: ["startAt", "endAt", "createdAt", "updatedAt"],
  expense: ["expenseDate", "dueDate", "createdAt", "updatedAt"],
  refund: ["createdAt", "completedAt", "cancelledAt"]
};

const IMPORT_ORDER = [
  "store",
  "user",
  "product",
  "customer",
  "supplier",
  "promotion",
  "purchase",
  "order",
  "purchaseItem",
  "orderItem",
  "payment",
  "paymentEvent",
  "receipt",
  "stockMovement",
  "cashSession",
  "expense",
  "promotionItem",
  "pointHistory",
  "refund"
];

const DELETE_ORDER = [
  "refund",
  "pointHistory",
  "promotionItem",
  "expense",
  "cashSession",
  "stockMovement",
  "receipt",
  "paymentEvent",
  "payment",
  "orderItem",
  "purchaseItem",
  "order",
  "purchase",
  "promotion",
  "customer",
  "supplier",
  "product",
  "user",
  "store"
];

function prepareRows(model, rows) {
  const dateFields = DATE_FIELDS[model] || [];

  return rows.map(row => {
    const prepared = { ...row };

    for (const field of dateFields) {
      if (prepared[field] !== null && prepared[field] !== undefined) {
        prepared[field] = new Date(prepared[field]);

        if (Number.isNaN(prepared[field].getTime())) {
          throw new Error(`Tanggal tidak valid: ${model}.${field}`);
        }
      }
    }

    return prepared;
  });
}

async function main() {
  const file = path.resolve(__dirname, "../prisma/demo-data.json");

  if (!fs.existsSync(file)) {
    throw new Error("File prisma/demo-data.json tidak ditemukan.");
  }

  const imported = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = imported.data;

  for (const model of IMPORT_ORDER) {
    if (!Array.isArray(data[model])) {
      throw new Error(`Data model ${model} tidak ditemukan atau bukan array.`);
    }
  }

  if (data.order.length !== 177) {
    throw new Error("Jumlah transaksi tidak sesuai. Import dibatalkan.");
  }

  if (data.user.length !== 3 || data.store.length !== 1) {
    throw new Error("Jumlah akun atau toko tidak sesuai. Import dibatalkan.");
  }

  const databaseUrl = new URL(TARGET_URL);

  console.log("===== TARGET DATABASE =====");
  console.log(`Host: ${databaseUrl.hostname}`);
  console.log(`Port: ${databaseUrl.port || "5432"}`);
  console.log(`Database: ${databaseUrl.pathname.slice(1)}`);
  console.log("");
  console.log("===== MEMULAI IMPORT ATOMIK =====");

  await prisma.$transaction(async tx => {
    for (const model of DELETE_ORDER) {
      const result = await tx[model].deleteMany();
      console.log(`Bersihkan ${model}: ${result.count}`);
    }

    for (const model of IMPORT_ORDER) {
      const rows = prepareRows(model, data[model]);

      if (rows.length > 0) {
        const result = await tx[model].createMany({
          data: rows
        });

        console.log(`Import ${model}: ${result.count}`);
      } else {
        console.log(`Import ${model}: 0`);
      }
    }
  }, {
    maxWait: 20000,
    timeout: 120000
  });

  console.log("");
  console.log("IMPORT DEMO BERHASIL.");
}

main()
  .catch(error => {
    console.error("");
    console.error("IMPORT GAGAL. Transaksi dibatalkan jika sudah dimulai.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
