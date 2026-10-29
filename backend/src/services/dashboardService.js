
const prisma = require("../lib/prisma");

function parseDate(value, label) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`${label} harus berformat YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${label} tidak valid`);
  }

  return date;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateMetrics(orders) {
  let revenue = 0;
  let grossProfit = 0;

  for (const order of orders) {
    revenue += Number(order.total) || 0;

    for (const item of order.items) {
      const sellingPrice = Number(item.price) || 0;
      const purchasePrice = Number(item.product.purchasePrice) || 0;

      grossProfit +=
        (sellingPrice - purchasePrice) * item.quantity;
    }
  }

  const transactions = orders.length;

  return {
    revenue,
    transactions,
    averageTransaction:
      transactions > 0 ? revenue / transactions : 0,
    grossProfit,
  };
}

function calculateChange(current, previous) {
  if (previous === 0) {
    return null;
  }

  return Number(((current - previous) / Math.abs(previous) * 100).toFixed(2));
}

async function getDashboard(storeId, options = {}) {
  if (!storeId) {
    throw new Error("storeId wajib diisi");
  }

  const now = new Date();

  let startDate = parseDate(options.startDate, "startDate");
  let endDate = parseDate(options.endDate, "endDate");

  if (Boolean(startDate) !== Boolean(endDate)) {
    throw new Error("startDate dan endDate harus diisi bersamaan");
  }

  if (!startDate && !endDate) {
    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    endDate = new Date(startDate);
  }

  if (startDate > endDate) {
    throw new Error("Tanggal mulai tidak boleh melewati tanggal akhir");
  }

  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  const rangeDays =
    Math.round((endOfDay.setHours(0, 0, 0, 0) - startOfDay.getTime()) / 86400000) + 1;

  // Pulihkan akhir periode setelah menghitung jumlah hari.
  endOfDay.setHours(23, 59, 59, 999);

  const previousStart = new Date(startOfDay);
  previousStart.setDate(previousStart.getDate() - rangeDays);

  const previousEnd = new Date(startOfDay);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);

  const orderInclude = {
    items: {
      include: {
        product: true,
      },
    },
    payment: true,
  };

  const periodOrders = await prisma.order.findMany({
    where: {
      storeId,
      status: "COMPLETED",
      payment: { is: { status: "PAID" } },
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: orderInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  const previousOrders = await prisma.order.findMany({
    where: {
      storeId,
      status: "COMPLETED",
      payment: { is: { status: "PAID" } },
      createdAt: {
        gte: previousStart,
        lte: previousEnd,
      },
    },
    include: orderInclude,
  });

  const currentMetrics = calculateMetrics(periodOrders);
  const previousMetrics = calculateMetrics(previousOrders);

  const periodExpenses = await prisma.expense.findMany({
    where: {
      storeId,
      expenseDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: {
      amount: true,
    },
  });

  const totalExpenses = periodExpenses.reduce(
    (total, expense) => total + (Number(expense.amount) || 0),
    0
  );

  const productSales = {};
  const paymentMethods = {};

  // Satu entri untuk setiap tanggal, termasuk tanggal tanpa penjualan.
  const salesMap = {};
  const cursor = new Date(startOfDay);

  while (cursor <= endOfDay) {
    salesMap[localDateKey(cursor)] = {
      date: localDateKey(cursor),
      revenue: 0,
      transactions: 0,
    };

    cursor.setDate(cursor.getDate() + 1);
  }

  for (const order of periodOrders) {
    const orderDate = localDateKey(new Date(order.createdAt));

    if (salesMap[orderDate]) {
      salesMap[orderDate].revenue += Number(order.total) || 0;
      salesMap[orderDate].transactions += 1;
    }

    for (const item of order.items) {
      const productId = item.productId;

      if (!productSales[productId]) {
        productSales[productId] = {
          productId,
          name: item.product.name,
          quantity: 0,
          revenue: 0,
        };
      }

      productSales[productId].quantity += item.quantity;
      productSales[productId].revenue += Number(item.subtotal) || 0;
    }

    if (order.payment) {
      const method = order.payment.method;

      if (!paymentMethods[method]) {
        paymentMethods[method] = {
          method,
          transactions: 0,
          revenue: 0,
        };
      }

      paymentMethods[method].transactions += 1;
      paymentMethods[method].revenue += Number(order.total) || 0;
    }
  }

  const bestSellers = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const lowStockProducts = await prisma.product.findMany({
    where: {
      storeId,
      isActive: true,
      stock: { lte: 5 },
    },
    orderBy: { stock: "asc" },
    take: 50,
  });

  // Recent Transactions mengikuti periode Dashboard yang aktif.
  const latestOrders = await prisma.order.findMany({
    where: {
      storeId,
      status: "COMPLETED",
      payment: { is: { status: "PAID" } },
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: orderInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  const recentTransactions = latestOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    status: order.status,
    paymentMethod: order.payment?.method || null,
    paidAt: order.payment?.paidAt || null,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productName: item.product.name,
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
    })),
  }));

  const netProfit = currentMetrics.grossProfit - totalExpenses;

  return {
    period: {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      previousStartDate: previousStart.toISOString(),
      previousEndDate: previousEnd.toISOString(),
    },

    kpi: {
      // Pertahankan nama field lama agar kompatibel dengan frontend.
      revenueToday: currentMetrics.revenue,
      transactionsToday: currentMetrics.transactions,
      averageTransaction: currentMetrics.averageTransaction,
      grossProfit: currentMetrics.grossProfit,
      expenses: totalExpenses,
      netProfit,
      revenue: currentMetrics.revenue,
      transactions: currentMetrics.transactions,
    },

    comparison: {
      revenue: calculateChange(
        currentMetrics.revenue,
        previousMetrics.revenue
      ),
      transactions: calculateChange(
        currentMetrics.transactions,
        previousMetrics.transactions
      ),
      averageTransaction: calculateChange(
        currentMetrics.averageTransaction,
        previousMetrics.averageTransaction
      ),
      grossProfit: calculateChange(
        currentMetrics.grossProfit,
        previousMetrics.grossProfit
      ),
      previous: previousMetrics,
    },

    salesByDate: Object.values(salesMap),
    bestSellers,

    lowStockProducts: lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      minimumStock: product.minimumStock,
      status: product.stock === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
    })),

    paymentMethods: Object.values(paymentMethods),
    recentTransactions,
  };
}

module.exports = {
  getDashboard,
};
