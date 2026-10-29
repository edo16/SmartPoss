const prisma = require("../lib/prisma");

async function getTransactions(storeId, filters = {}) {
  if (!storeId) {
    throw new Error("storeId wajib diisi");
  }

  const {
    search = "",
    date = "",
    paymentMethod = "",
    status = "",
  } = filters;

  const where = {
    storeId,
  };

  // Filter status
  if (status) {
    where.status = status;
  }

  // Filter tanggal
  if (date) {
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59.999`);

    where.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  // Search nomor transaksi
  if (search) {
    where.orderNumber = {
      contains: search,
      mode: "insensitive",
    };
  }

  // Payment method
  if (paymentMethod) {
    where.payment = {
      method: paymentMethod,
    };
  }

  const orders = await prisma.order.findMany({
    where,

    include: {
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },

      items: {
        include: {
          product: true,
        },
      },

      payment: true,

      refunds: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  const transactions = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,

    customerId: order.customerId || null,

customerName:
  order.customer?.name ||
  order.customerName ||
  "Pelanggan Umum",

customerPhone: order.customer?.phone || null,

isRegisteredCustomer: Boolean(
  order.customerId && order.customer
),

    date: order.createdAt,

    status: order.status,

    paymentMethod: order.payment?.method || null,

    paymentStatus: order.payment?.status || null,

    paidAt: order.payment?.paidAt || null,

    subtotal: Number(order.subtotal),

    discount: Number(order.discount || 0),

    tax: Number(order.tax || 0),

    total: Number(order.total),

    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      price: Number(item.price),
      subtotal: Number(item.subtotal),
    })),

    refunds: (order.refunds || []).map((refund) => ({
      id: refund.id,
      amount: Number(refund.amount),
      reason: refund.reason,
      status: refund.status,
      requestedById: refund.requestedById,
      confirmedById: refund.confirmedById,
      createdAt: refund.createdAt,
      completedAt: refund.completedAt,
      cancelledAt: refund.cancelledAt,
    })),

    refundedTotal: (order.refunds || [])
      .filter((refund) => refund.status === "COMPLETED")
      .reduce((sum, refund) => sum + Number(refund.amount), 0),
  }));

  // Summary

  // Revenue dan jumlah transaksi hanya menghitung pesanan selesai
  // dengan pembayaran yang benar-benar berhasil.
  const paidTransactions = transactions.filter(
    (transaction) =>
      String(transaction.paymentStatus || "").toUpperCase() === "PAID" &&
      String(transaction.status || "").toUpperCase() === "COMPLETED"
  );

  const totalCount = paidTransactions.length;

const totalRevenue = paidTransactions.reduce(
  (sum, transaction) => sum + transaction.total,
  0
);

const cashTotal = paidTransactions
  .filter(
    (transaction) => transaction.paymentMethod === "CASH"
  )
  .reduce(
    (sum, transaction) => sum + transaction.total,
    0
  );

const qrisTotal = paidTransactions
  .filter(
    (transaction) => transaction.paymentMethod === "QRIS"
  )
  .reduce(
    (sum, transaction) => sum + transaction.total,
    0
  );

  return {
    summary: {
      totalCount,
      totalRevenue,
      cashTotal,
      qrisTotal,
    },

    transactions,
  };
}

async function getTransactionById(
  storeId,
  transactionId
) {
  if (!storeId) {
    throw new Error("storeId wajib diisi");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: transactionId,
      storeId,
    },

    include: {
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },

      items: {
        include: {
          product: true,
        },
      },

      payment: true,

      refunds: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!order) {
    throw new Error("Transaksi tidak ditemukan");
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,

    customerId: order.customerId || null,

customerName:
  order.customer?.name ||
  order.customerName ||
  "Pelanggan Umum",

isRegisteredCustomer:
  Boolean(order.customerId && order.customer),

    date: order.createdAt,
    status: order.status,

    paymentMethod:
      order.payment?.method || null,

    paymentStatus:
      order.payment?.status || null,

    paidAt:
      order.payment?.paidAt || null,

    subtotal: Number(order.subtotal),
    discount: Number(order.discount || 0),
    tax: Number(order.tax || 0),
    total: Number(order.total),

    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      price: Number(item.price),
      subtotal: Number(item.subtotal),
    })),

    refunds: (order.refunds || []).map((refund) => ({
      id: refund.id,
      amount: Number(refund.amount),
      reason: refund.reason,
      status: refund.status,
      requestedById: refund.requestedById,
      confirmedById: refund.confirmedById,
      createdAt: refund.createdAt,
      completedAt: refund.completedAt,
      cancelledAt: refund.cancelledAt,
    })),

    refundedTotal: (order.refunds || [])
      .filter((refund) => refund.status === "COMPLETED")
      .reduce((sum, refund) => sum + Number(refund.amount), 0),
  };
}

module.exports = {
  getTransactions,
  getTransactionById,
};