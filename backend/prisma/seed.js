require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");

async function main() {
  console.log("🌱 Starting SmartPOS seed...");

  // ==========================================
  // 1. STORE
  // ==========================================

  const store = await prisma.store.upsert({
    where: {
      id: "smartpos-demo-store",
    },
    update: {},
    create: {
      id: "smartpos-demo-store",
      name: "SmartPOS Demo Store",
      address: "Bandar Lampung, Lampung",
      phone: "081234567890",
      email: "smartpos@example.com",
    },
  });

  console.log("🏪 Store:", store.name);

  // ==========================================
  // 2. USERS
  // ==========================================

  const seedDefaultPassword = process.env.SEED_DEFAULT_PASSWORD;

  if (!seedDefaultPassword || seedDefaultPassword.length < 12) {
    throw new Error(
      "SEED_DEFAULT_PASSWORD wajib diatur dan minimal 12 karakter sebelum menjalankan seed."
    );
  }

  const password = await bcrypt.hash(seedDefaultPassword, 12);

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@smartpos.com",
    },
    update: {},
    create: {
      name: "SmartPOS Admin",
      email: "admin@smartpos.com",
      password,
      role: "ADMIN",
    },
  });

  const manager = await prisma.user.upsert({
    where: {
      email: "manager@smartpos.com",
    },
    update: {},
    create: {
      name: "SmartPOS Manager",
      email: "manager@smartpos.com",
      password,
      role: "MANAGER",
    },
  });

  const cashier = await prisma.user.upsert({
    where: {
      email: "cashier@smartpos.com",
    },
    update: {},
    create: {
      name: "SmartPOS Cashier",
      email: "cashier@smartpos.com",
      password,
      role: "CASHIER",
    },
  });

  console.log("👤 Users created:");
  console.log("   -", admin.email);
  console.log("   -", manager.email);
  console.log("   -", cashier.email);

  // ==========================================
  // 3. PRODUCTS
  // ==========================================

  const products = [
    {
      name: "Mie Ayam",
      sku: "FOOD-001",
      barcode: "899100000001",
      category: "Makanan",
      description: "Mie ayam dengan topping ayam dan sayuran",
      purchasePrice: 8000,
      sellingPrice: 15000,
      stock: 50,
      minimumStock: 10,
    },
    {
      name: "Bakso",
      sku: "FOOD-002",
      barcode: "899100000002",
      category: "Makanan",
      description: "Bakso sapi dengan kuah gurih",
      purchasePrice: 9000,
      sellingPrice: 17000,
      stock: 40,
      minimumStock: 10,
    },
    {
      name: "Nasi Goreng",
      sku: "FOOD-003",
      barcode: "899100000003",
      category: "Makanan",
      description: "Nasi goreng spesial",
      purchasePrice: 10000,
      sellingPrice: 18000,
      stock: 35,
      minimumStock: 8,
    },
    {
      name: "Es Teh",
      sku: "DRINK-001",
      barcode: "899100000004",
      category: "Minuman",
      description: "Es teh manis",
      purchasePrice: 2500,
      sellingPrice: 5000,
      stock: 100,
      minimumStock: 20,
    },
    {
      name: "Es Jeruk",
      sku: "DRINK-002",
      barcode: "899100000005",
      category: "Minuman",
      description: "Es jeruk segar",
      purchasePrice: 3500,
      sellingPrice: 7000,
      stock: 80,
      minimumStock: 15,
    },
    {
      name: "Kopi Susu",
      sku: "DRINK-003",
      barcode: "899100000006",
      category: "Minuman",
      description: "Kopi susu kekinian",
      purchasePrice: 7000,
      sellingPrice: 12000,
      stock: 60,
      minimumStock: 15,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: {
        id: `${store.id}-${product.sku}`,
      },
      update: {
        name: product.name,
        sellingPrice: product.sellingPrice,
        purchasePrice: product.purchasePrice,
        stock: product.stock,
        minimumStock: product.minimumStock,
        category: product.category,
        description: product.description,
      },
      create: {
        id: `${store.id}-${product.sku}`,
        storeId: store.id,
        ...product,
      },
    });
  }

  console.log(`📦 Products created: ${products.length}`);

  // ==========================================
  // 4. CUSTOMER
  // ==========================================

  const customer = await prisma.customer.create({
    data: {
      storeId: store.id,
      name: "Customer Demo",
      phone: "081298765432",
      email: "customer@example.com",
      loyaltyPoints: 100,
      totalSpent: 250000,
    },
  });

  console.log("👥 Customer:", customer.name);

  // ==========================================
  // 5. SUPPLIER
  // ==========================================

  const supplier = await prisma.supplier.upsert({
    where: {
      id: "smartpos-demo-supplier",
    },
    update: {
      name: "Supplier Demo",
      phone: "081211223344",
      email: "supplier@example.com",
      address: "Bandar Lampung",
    },
    create: {
      id: "smartpos-demo-supplier",
      storeId: store.id,
      name: "Supplier Demo",
      phone: "081211223344",
      email: "supplier@example.com",
      address: "Bandar Lampung",
    },
  });

  console.log("🏭 Supplier:", supplier.name);

  console.log("");
  console.log("========================================");
  console.log("✅ SMARTPOS SEED SUCCESS");
  console.log("========================================");
  console.log("🏪 Store ID :", store.id);
  console.log("👤 Admin    :", admin.email);
  console.log("👤 Manager  :", manager.email);
  console.log("👤 Cashier  :", cashier.email);
  console.log("📦 Products :", products.length);
  console.log("========================================");
}

main()
  .catch((error) => {
    console.error("❌ SEED ERROR:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });