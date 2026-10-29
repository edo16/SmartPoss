
const prisma = require("../lib/prisma");

/* =====================================================
   DATE HELPERS
===================================================== */

function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        throw new Error("Format tanggal harus YYYY-MM-DD");
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        throw new Error("Tanggal tidak valid");
    }

    return date;
}

function addLocalDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function startOfLocalDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function endOfLocalDay(date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* =====================================================
   MAIN ANALYTICS
===================================================== */

async function getAnalytics(
    storeId,
    days = 7,
    startDateInput,
    endDateInput
) {
    if (!storeId) {
        throw new Error("storeId wajib diisi");
    }

    const now = new Date();
    const hasStartDate = Boolean(startDateInput);
    const hasEndDate = Boolean(endDateInput);

    if (hasStartDate !== hasEndDate) {
        throw new Error(
            "startDate dan endDate harus diisi bersamaan"
        );
    }

    const hasCustomRange = hasStartDate && hasEndDate;

    let startDate;
    let endDate;
    let periodDays;

    /* ================================================
       1. TENTUKAN PERIODE
    ================================================ */

    if (hasCustomRange) {
        startDate = parseLocalDate(startDateInput);
        endDate = endOfLocalDay(parseLocalDate(endDateInput));

        if (startDate > endDate) {
            throw new Error(
                "Tanggal mulai tidak boleh melewati tanggal akhir"
            );
        }

        if (startDate > now) {
            throw new Error(
                "Tanggal mulai tidak boleh berada di masa depan"
            );
        }

        if (endDate > now) {
            endDate = new Date(now);
        }

        const firstDay = startOfLocalDay(startDate);
        const lastDay = startOfLocalDay(endDate);

        periodDays =
            Math.round(
                (lastDay.getTime() - firstDay.getTime()) /
                    86400000
            ) + 1;
    } else {
        const requestedDays = Number(days);

        periodDays = Math.min(
            Math.max(
                Number.isFinite(requestedDays)
                    ? Math.floor(requestedDays)
                    : 7,
                1
            ),
            90
        );

        endDate = new Date(now);
        startDate = startOfLocalDay(
            addLocalDays(now, -(periodDays - 1))
        );
    }

    if (
        !Number.isFinite(startDate.getTime()) ||
        !Number.isFinite(endDate.getTime()) ||
        startDate > endDate
    ) {
        throw new Error("Rentang tanggal tidak valid");
    }

    /* ================================================
       2. PERIODE SEBELUMNYA
       Durasi sama dengan periode aktif
    ================================================ */

    const previousEndDate = new Date(startDate.getTime() - 1);

    const previousStartDate = startOfLocalDay(
        addLocalDays(startDate, -periodDays)
    );

    /* ================================================
       3. AMBIL DATA DARI DATABASE
    ================================================ */

    const [
        orders,
        expenses,
        previousOrders,
    ] = await Promise.all([
        prisma.order.findMany({
            where: {
                storeId,
                status: "COMPLETED",
                payment: { is: { status: "PAID" } },
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                payment: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        }),

        prisma.expense.findMany({
            where: {
                storeId,
                expenseDate: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                amount: true,
                expenseDate: true,
            },
        }),

        prisma.order.findMany({
            where: {
                storeId,
                status: "COMPLETED",
                payment: { is: { status: "PAID" } },
                createdAt: {
                    gte: previousStartDate,
                    lte: previousEndDate,
                },
            },
            select: {
                total: true,
                createdAt: true,
            },
        }),
    ]);

    /* ================================================
       4. SIAPKAN DATA HARIAN
    ================================================ */

    const dailyMap = {};

    for (let i = 0; i < periodDays; i++) {
        const date = addLocalDays(
            startOfLocalDay(startDate),
            i
        );

        const key = getLocalDateKey(date);

        dailyMap[key] = {
            date: key,
            revenue: 0,
            expenses: 0,
            transactions: 0,
            profit: 0,
            netProfit: 0,
        };
    }

    /* ================================================
       5. SIAPKAN MAP PRODUK, PEMBAYARAN, DAN JAM
    ================================================ */

    const productMap = {};
    const paymentMap = {};

    const busyHourMap = Array.from(
        { length: 24 },
        (_, hour) => ({
            hour,
            hourLabel: `${String(hour).padStart(2, "0")}:00`,
            transactions: 0,
            revenue: 0,
        })
    );

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalExpenses = 0;

    /* ================================================
       6. PROSES TRANSAKSI SELESAI
    ================================================ */

    for (const order of orders) {
        const revenue = toNumber(order.total);
        const orderDate = getLocalDateKey(
            new Date(order.createdAt)
        );

        totalRevenue += revenue;

        /* Revenue dan jumlah transaksi harian */

        if (dailyMap[orderDate]) {
            dailyMap[orderDate].revenue += revenue;
            dailyMap[orderDate].transactions += 1;
        }

        /* Jam ramai pembeli */

        const hour = new Date(order.createdAt).getHours();

        busyHourMap[hour].transactions += 1;
        busyHourMap[hour].revenue += revenue;

        /* Metode pembayaran */

        if (order.payment) {
            const method = order.payment.method || "UNKNOWN";

            if (!paymentMap[method]) {
                paymentMap[method] = {
                    method,
                    transactions: 0,
                    revenue: 0,
                };
            }

            paymentMap[method].transactions += 1;
            paymentMap[method].revenue += revenue;
        }

        /* Penjualan dan keuntungan produk */

        for (const item of order.items || []) {
            if (!item.product) continue;

            const productId = item.productId;
            const quantity = toNumber(item.quantity);
            const sellingPrice = toNumber(item.price);
            const purchasePrice = toNumber(
                item.product.purchasePrice
            );

            const itemRevenue = item.subtotal != null
                ? toNumber(item.subtotal)
                : sellingPrice * quantity;

            const itemProfit =
                (sellingPrice - purchasePrice) * quantity;

            totalProfit += itemProfit;

            if (!productMap[productId]) {
                productMap[productId] = {
                    productId,
                    name: item.product.name || "Produk",
                    quantity: 0,
                    revenue: 0,
                    profit: 0,
                };
            }

            productMap[productId].quantity += quantity;
            productMap[productId].revenue += itemRevenue;
            productMap[productId].profit += itemProfit;

            if (dailyMap[orderDate]) {
                dailyMap[orderDate].profit += itemProfit;
            }
        }
    }

    /* ================================================
       7. PROSES PENGELUARAN
    ================================================ */

    for (const expense of expenses) {
        const amount = toNumber(expense.amount);

        const expenseDate = getLocalDateKey(
            new Date(expense.expenseDate)
        );

        totalExpenses += amount;

        if (dailyMap[expenseDate]) {
            dailyMap[expenseDate].expenses += amount;
        }
    }

    /* ================================================
       8. HITUNG LABA BERSIH HARIAN
    ================================================ */

    for (const day of Object.values(dailyMap)) {
        day.revenue = roundMoney(day.revenue);
        day.expenses = roundMoney(day.expenses);
        day.profit = roundMoney(day.profit);

        day.netProfit = roundMoney(
            day.profit - day.expenses
        );
    }

    /* ================================================
       9. URUTKAN PRODUK
    ================================================ */

    const allProducts = Object.values(productMap).map(
        product => ({
            ...product,
            revenue: roundMoney(product.revenue),
            profit: roundMoney(product.profit),
        })
    );

    const topProducts = [...allProducts]
        .sort((a, b) => {
            return (
                b.quantity - a.quantity ||
                b.revenue - a.revenue
            );
        })
        .slice(0, 10);

    const profitableProducts = [...allProducts]
        .sort((a, b) => {
            return (
                b.profit - a.profit ||
                b.revenue - a.revenue
            );
        })
        .slice(0, 10);

    /* ================================================
       10. RINGKASAN METODE PEMBAYARAN
    ================================================ */

    const paymentMethods = Object.values(paymentMap).map(
        payment => ({
            ...payment,
            revenue: roundMoney(payment.revenue),
        })
    );

    /* ================================================
       11. PERBANDINGAN PENJUALAN
    ================================================ */

    const previousRevenue = previousOrders.reduce(
        (total, order) => {
            return total + toNumber(order.total);
        },
        0
    );

    const revenueDifference = totalRevenue - previousRevenue;

    const percentageChange = previousRevenue > 0
        ? (revenueDifference / previousRevenue) * 100
        : null;

    const comparison = {
        currentLabel:
            `${getLocalDateKey(startDate)} – ${getLocalDateKey(endDate)}`,

        previousLabel:
            `${getLocalDateKey(previousStartDate)} – ${getLocalDateKey(previousEndDate)}`,

        currentRevenue: roundMoney(totalRevenue),
        previousRevenue: roundMoney(previousRevenue),
        revenueDifference: roundMoney(revenueDifference),

        percentageChange: percentageChange === null
            ? null
            : roundMoney(percentageChange),
    };

    /* ================================================
       12. KPI DAN SUMMARY
    ================================================ */

    const totalTransactions = orders.length;

    const grossProfit = roundMoney(totalProfit);
    const netProfit = roundMoney(
        totalProfit - totalExpenses
    );

    const summary = {
        revenue: roundMoney(totalRevenue),

        transactions: totalTransactions,

        averageTransaction: totalTransactions
            ? roundMoney(totalRevenue / totalTransactions)
            : 0,

        grossProfit,

        expenses: roundMoney(totalExpenses),

        netProfit,

        profitMargin: totalRevenue
            ? roundMoney((totalProfit / totalRevenue) * 100)
            : 0,
    };

    /* ================================================
       13. KEMBALIKAN DATA KE FRONTEND
    ================================================ */

    return {
        period: {
            days: periodDays,
            startDate,
            endDate,
        },

        summary,

        dailySales: Object.values(dailyMap),

        topProducts,

        profitableProducts,

        paymentMethods,

        busyHours: busyHourMap,

        comparison,
    };
}

module.exports = {
    getAnalytics,
};
