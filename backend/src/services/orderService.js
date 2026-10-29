const prisma = require("../lib/prisma");

function generateOrderNumber() {
  const now = new Date();

  const date = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const random = Math.floor(
    100000 + Math.random() * 900000
  );

  return `ORD-${date}-${random}`;
}

// ========================================
// CREATE ORDER
// ========================================

async function createOrder(data) {
  const {
    storeId,
    cashierId,
    customerId,
    customerName,
    items,
    discount = 0,
    discountPercent,
    tax = 0,
    taxPercent,
    serviceCharge = 0,
    notes,
    paymentMethod = "CASH",
    pointsUsed = 0,
  } = data;

  if (!storeId) {
    throw new Error("storeId wajib diisi");
  }

  if (!cashierId) {
    throw new Error("cashierId wajib diisi");
  }

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      "Minimal satu produk harus dipilih"
    );
  }

// ========================================
// MEMBER / LOYALTY POINTS
// ========================================

let customer = null;

if (customerId) {
  customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      storeId,
    },
  });

  if (!customer) {
    throw new Error(
      "Member tidak ditemukan atau bukan milik store ini"
    );
  }
}

const requestedPoints =
  Number(pointsUsed) || 0;

if (requestedPoints < 0) {
  throw new Error(
    "Jumlah poin yang digunakan tidak valid"
  );
}

if (requestedPoints > 0) {
  if (!customer) {
    throw new Error(
      "Poin hanya dapat digunakan oleh member"
    );
  }

  if (
    requestedPoints < 100 ||
    requestedPoints % 100 !== 0
  ) {
    throw new Error(
      "Poin yang digunakan minimal 100 dan harus kelipatan 100"
    );
  }

  if (
    requestedPoints >
    customer.loyaltyPoints
  ) {
    throw new Error(
      `Poin tidak mencukupi. Poin tersedia: ${customer.loyaltyPoints}`
    );
  }
}

const pointsDiscountAmount =
  (requestedPoints / 100) * 10000;

  // ========================================
  // GET PRODUCTS
  // ========================================

  const productIds = items.map(
    (item) => item.productId
  );

  const products =
    await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        storeId,
        isActive: true,
      },
    });

  if (
    products.length !== productIds.length
  ) {
    throw new Error(
      "Ada produk yang tidak ditemukan atau tidak aktif"
    );
  }

  // ========================================
  // CALCULATE ORDER
  // ========================================

  let subtotal = 0;

  const orderItems = items.map(
    (item) => {
      const product =
        products.find(
          (p) =>
            p.id === item.productId
        );

      const quantity =
        Number(item.quantity);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          `Quantity tidak valid untuk produk ${product.name}`
        );
      }

      if (
        quantity > product.stock
      ) {
        throw new Error(
          `Stock ${product.name} tidak mencukupi`
        );
      }

      const price =
        Number(product.sellingPrice);

      const itemSubtotal =
        price * quantity;

      subtotal += itemSubtotal;

      return {
        productId: product.id,
        quantity,
        price: product.sellingPrice,
        subtotal: itemSubtotal,
      };
    }
  );

  const hasDiscountPercent =
    discountPercent !== undefined && discountPercent !== null;
const hasTaxPercent =
    taxPercent !== undefined && taxPercent !== null;

function validatePercent(value, label) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(`${label} harus berupa angka antara 0 dan 100 persen`);
  }
  return percent;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const validatedDiscountPercent = hasDiscountPercent
  ? validatePercent(discountPercent, "Diskon")
  : null;
const validatedTaxPercent = hasTaxPercent
  ? validatePercent(taxPercent, "Pajak")
  : null;

const discountAmount = roundMoney(
  hasDiscountPercent
    ? subtotal * validatedDiscountPercent / 100
    : Math.max(0, Number(discount) || 0)
);

if (pointsDiscountAmount > subtotal) {
  throw new Error("Diskon poin tidak boleh melebihi subtotal transaksi");
}
if (discountAmount + pointsDiscountAmount > subtotal) {
  throw new Error("Total diskon tidak boleh melebihi subtotal transaksi");
}

const taxBase = Math.max(0, subtotal - discountAmount - pointsDiscountAmount);
const taxAmount = roundMoney(
  hasTaxPercent
    ? taxBase * validatedTaxPercent / 100
    : Math.max(0, Number(tax) || 0)
);
const serviceChargeAmount = Math.max(0, Number(serviceCharge) || 0);
const total = roundMoney(
  subtotal - discountAmount - pointsDiscountAmount +
  taxAmount + serviceChargeAmount
);

if (total < 0) {
  throw new Error("Total transaksi tidak valid");
}

  const orderNumber =
    generateOrderNumber();

  // ========================================
  // CREATE ORDER
  // ========================================

  const order =
    await prisma.$transaction(
      async (tx) => {
        const createdOrder =
          await tx.order.create({
            data: {
              orderNumber,

              storeId,

              cashierId,

              customerId:
              customerId || null,

            customerName:
              customerId
                ? null
                : (String(customerName || "").trim().slice(0, 100) || null),

              subtotal,

              discount:
                discountAmount,

              pointsUsed:
                requestedPoints,

              pointsDiscount:
                pointsDiscountAmount,

              tax:
                taxAmount,

              serviceCharge:
                serviceChargeAmount,

              total,

              // Order tetap PENDING
              // sampai payment berhasil
              status: "PENDING",

              notes:
                notes || null,

              items: {
                create:
                  orderItems,
              },

              payment: {
                create: {
                  method:
                    paymentMethod,

                  // SEMUA PAYMENT
                  // awalnya PENDING
                  status: "PENDING",

                  amount: total,

                  paidAt: null,
                },
              },
            },

            include: {
              items: {
                include: {
                  product: true,
                },
              },

              payment: true,

              customer: true,

              cashier: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          });

        return createdOrder;
      }
    );

  return order;
}

// ========================================
// GET ORDER BY ID
// ========================================

async function getOrderById(id) {
  return await prisma.order.findUnique({
    where: {
      id,
    },

    include: {
      items: {
        include: {
          product: true,
        },
      },

      payment: true,

      receipt: true,

      customer: true,

      cashier: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

// ========================================
// GET ORDERS
// ========================================

async function getOrders(storeId) {
  return await prisma.order.findMany({
    where: {
      storeId,
    },

    include: {
      items: {
        include: {
          product: true,
        },
      },

      payment: true,

      customer: true,

      cashier: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

module.exports = {
  createOrder,
  getOrderById,
  getOrders,
};