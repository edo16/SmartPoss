const fs = require("fs");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL
  })
});

const DEMO_PASSWORD = "SmartPOS-Demo-2026!";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL database asli tidak ditemukan.");
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const tables = [
    ["store", () => prisma.store.findMany()],
    ["user", () => prisma.user.findMany()],
    ["product", () => prisma.product.findMany()],
    ["customer", () => prisma.customer.findMany()],
    ["pointHistory", () => prisma.pointHistory.findMany()],
    ["supplier", () => prisma.supplier.findMany()],
    ["purchase", () => prisma.purchase.findMany()],
    ["purchaseItem", () => prisma.purchaseItem.findMany()],
    ["order", () => prisma.order.findMany()],
    ["orderItem", () => prisma.orderItem.findMany()],
    ["payment", () => prisma.payment.findMany()],
    ["paymentEvent", () => prisma.paymentEvent.findMany()],
    ["receipt", () => prisma.receipt.findMany()],
    ["stockMovement", () => prisma.stockMovement.findMany()],
    ["cashSession", () => prisma.cashSession.findMany()],
    ["promotion", () => prisma.promotion.findMany()],
    ["promotionItem", () => prisma.promotionItem.findMany()],
    ["expense", () => prisma.expense.findMany()],
    ["refund", () => prisma.refund.findMany()]
  ];

  const data = {};

  for (const [name, query] of tables) {
    data[name] = await query();
    console.log(`${name}: ${data[name].length}`);
  }

  const roleCounters = {};

  data.user = data.user.map(user => {
    const role = String(user.role).toLowerCase();
    roleCounters[role] = (roleCounters[role] || 0) + 1;

    const suffix = roleCounters[role] > 1
      ? `-${roleCounters[role]}`
      : "";

    return {
      ...user,
      name: `Demo ${role.toUpperCase()}${suffix}`,
      email: `${role}${suffix}@smartpos.com`,
      password: passwordHash
    };
  });

  data.store = data.store.map(store => ({
    ...store,
    name: "SmartPOS Demo Store",
    address: "Alamat Demo, Bandar Lampung",
    phone: null,
    email: null
  }));

  data.product = data.product.map(product => ({
    ...product,
    barcode: null,
    description: product.description ? "Produk untuk demonstrasi SmartPOS" : null
  }));

  data.customer = data.customer.map((customer, index) => ({
    ...customer,
    name: `Pelanggan Demo ${String(index + 1).padStart(3, "0")}`,
    phone: null,
    email: null,
    memberCode: `DEMO-CUST-${String(index + 1).padStart(3, "0")}`
  }));

  data.supplier = data.supplier.map((supplier, index) => ({
    ...supplier,
    name: `Supplier Demo ${String(index + 1).padStart(3, "0")}`,
    phone: null,
    email: null,
    address: "Alamat Supplier Demo"
  }));

  data.purchase = data.purchase.map((purchase, index) => ({
    ...purchase,
    purchaseNumber: `DEMO-${purchase.purchaseNumber}`,
    notes: purchase.notes ? `Catatan pembelian demo ${index + 1}` : null
  }));

  data.order = data.order.map(order => ({
    ...order,
    orderNumber: `DEMO-${order.orderNumber}`,
    customerName: order.customerName
      ? "Pelanggan Demo"
      : null,
    notes: null
  }));

  data.payment = data.payment.map(payment => ({
    ...payment,
    provider: null,
    providerPaymentId: null,
    externalOrderId: null,
    qrString: null,
    qrUrl: null
  }));

  data.paymentEvent = data.paymentEvent.map(event => ({
    ...event,
    provider: "DEMO",
    eventId: null,
    payload: { demo: true }
  }));

  data.receipt = data.receipt.map(receipt => ({
    ...receipt,
    receiptNumber: `DEMO-${receipt.receiptNumber}`
  }));

  data.stockMovement = data.stockMovement.map(movement => ({
    ...movement,
    referenceId: null,
    notes: movement.notes ? "Aktivitas stok demo" : null
  }));

  data.promotion = data.promotion.map((promotion, index) => ({
    ...promotion,
    name: `Promo Demo ${String(index + 1).padStart(3, "0")}`,
    code: promotion.code
      ? `DEMO-PROMO-${String(index + 1).padStart(3, "0")}`
      : null,
    description: promotion.description
      ? "Promosi untuk demonstrasi"
      : null
  }));

  data.pointHistory = data.pointHistory.map(history => ({
    ...history,
    description: history.description ? "Riwayat poin demo" : null
  }));

  data.expense = data.expense.map((expense, index) => ({
    ...expense,
    description: `Pengeluaran Demo ${index + 1}`,
    category: expense.category ? "Operasional Demo" : null
  }));

  data.refund = data.refund.map(refund => ({
    ...refund,
    reason: "Simulasi refund untuk data demonstrasi"
  }));

  data.purchaseItem = data.purchaseItem;
  data.orderItem = data.orderItem;
  data.promotionItem = data.promotionItem;
  data.cashSession = data.cashSession;

  const output = path.resolve(__dirname, "../prisma/demo-data.json");

  fs.writeFileSync(
    output,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      data
    }, null, 2)
  );

  console.log("");
  console.log("EKSPOR DEMO BERHASIL");
  console.log("File:", output);
  console.log("Password seluruh akun demo:", DEMO_PASSWORD);
}

main()
  .catch(error => {
    console.error("EKSPOR GAGAL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
