const prisma = require("../lib/prisma");
const ExcelJS = require("exceljs");
const analyticsService = require("./analyticsService");

function localDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addTotals(target, row) {
  target.revenue += Number(row.revenue || 0);
  target.transactions += Number(row.transactions || 0);
  target.grossProfit += Number(row.profit || 0);
  target.expenses += Number(row.expenses || 0);
  target.netProfit += Number(row.netProfit || 0);
}

function aggregateRows(rows, type) {
  const groups = new Map();

  for (const row of rows) {
    const date = localDate(row.date);
    let key;
    let label;

    if (type === "weekly") {
      const monday = new Date(date);
      const weekday = (monday.getDay() + 6) % 7;
      monday.setDate(monday.getDate() - weekday);
      key = dateKey(monday);
      label = `Minggu mulai ${key}`;
    } else if (type === "monthly") {
      key = row.date.slice(0, 7);
      label = key;
    } else {
      key = row.date.slice(0, 4);
      label = key;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        period: label,
        revenue: 0,
        transactions: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
      });
    }

    addTotals(groups.get(key), row);
  }

  return Array.from(groups.values()).map(row => ({
    ...row,
    revenue: money(row.revenue),
    grossProfit: money(row.grossProfit),
    expenses: money(row.expenses),
    netProfit: money(row.netProfit),
  }));
}

function money(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function getReport(storeId, startDate, endDate) {
  if (!storeId) throw new Error("storeId wajib diisi");

  const start = localDate(startDate);
  const endExclusive = localDate(endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const analytics = await analyticsService.getAnalytics(
    storeId,
    7,
    startDate,
    endDate
  );

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: "COMPLETED",
      payment: { is: { status: "PAID" } },
      createdAt: {
        gte: start,
        lt: endExclusive,
      },
    },
    include: {
      cashier: true,
      payment: true,
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const dailySales = (analytics.dailySales || []).map(row => ({
    date: row.date,
    revenue: money(row.revenue),
    transactions: Number(row.transactions || 0),
    profit: money(row.profit),
    expenses: money(row.expenses),
    netProfit: money(row.netProfit),
  }));

  const transactions = orders.map(order => ({
    date: dateKey(new Date(order.createdAt)),
    time: new Date(order.createdAt).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    orderNumber: order.orderNumber,
    cashier: order.cashier?.name || order.cashier?.email || "-",
    customer: order.customerName || "-",
    paymentMethod: order.payment?.method || "-",
    total: money(order.total),
    discount: money(order.discount),
    items: (order.items || []).map(item =>
      `${item.product?.name || "Produk"} x${item.quantity}`
    ).join(", "),
  }));

  return {
    period: { startDate, endDate },
    summary: analytics.summary,
    dailySales,
    weeklySales: aggregateRows(dailySales, "weekly"),
    monthlySales: aggregateRows(dailySales, "monthly"),
    yearlySales: aggregateRows(dailySales, "yearly"),
    topProducts: analytics.topProducts || [],
    paymentMethods: analytics.paymentMethods || [],
    transactions,
  };
}

function styleWorksheet(sheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF263B5A" },
  };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.getRow(1).height = 22;

  sheet.columns.forEach(column => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: false }, cell => {
      maxLength = Math.max(maxLength, String(cell.value ?? "").length);
    });
    column.width = Math.min(maxLength + 2, 42);
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: {
      row: Math.max(sheet.rowCount, 1),
      column: Math.max(sheet.columnCount, 1),
    },
  };
}

function addTableSheet(workbook, name, headers, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  styleWorksheet(sheet);
  return sheet;
}

async function createExcel(report, groupingMode = "day") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SmartPOS";
  workbook.created = new Date();
  workbook.subject = "Rekap penjualan";
  workbook.title = `Rekap ${report.period.startDate} - ${report.period.endDate}`;

  const validModes = ["day", "week", "month", "year"];
  const mode = validModes.includes(groupingMode) ? groupingMode : "day";
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const groups = new Map();
  for (const day of report.dailySales || []) {
    const parts = String(day.date).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) continue;

    const [year, month, date] = parts;
    if (month < 1 || month > 12 || date < 1 || date > 31) continue;

    let key;
    let label;

    if (mode === "week") {
      const week = Math.floor((date - 1) / 7) + 1;
      key = `${year}-${String(month).padStart(2, "0")}-W${week}`;
      label = `Minggu ${week} ${monthNames[month - 1]} ${year}`;
    } else if (mode === "month") {
      key = `${year}-${String(month).padStart(2, "0")}`;
      label = `${monthNames[month - 1]} ${year}`;
    } else if (mode === "year") {
      key = String(year);
      label = String(year);
    } else {
      key = String(day.date);
      label = new Date(year, month - 1, date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        period: label,
        transactions: 0,
        revenue: 0,
        expenses: 0,
      });
    }

    const group = groups.get(key);
    group.transactions += Number(day.transactions) || 0;
    group.revenue += Number(day.revenue) || 0;
    group.expenses += Number(day.expenses) || 0;
  }

  const rows = Array.from(groups.values()).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  const summary = report.summary || {};
  const revenue = Number(summary.revenue) || 0;
  const expenses = Number(summary.expenses) || 0;

  const sheet = workbook.addWorksheet("Rekap Penjualan");
  sheet.addRow([
    "Periode",
    "Jumlah Transaksi",
    "Total Penjualan",
    "Pengeluaran",
    "Total setelah pengeluaran",
  ]);

  for (const row of rows) {
    sheet.addRow([
      row.period,
      row.transactions,
      Math.round((row.revenue + Number.EPSILON) * 100) / 100,
      Math.round((row.expenses + Number.EPSILON) * 100) / 100,
      Math.round((row.revenue - row.expenses + Number.EPSILON) * 100) / 100,
    ]);
  }

  const dataEndRow = sheet.rowCount;
  const summaryRows = [
    ["Total", revenue],
    ["Pengeluaran", expenses],
    ["Total setelah pengeluaran", revenue - expenses],
  ];

  for (const [label, amount] of summaryRows) {
    const rowNumber = sheet.rowCount + 1;
    sheet.addRow([label, null, null, null, amount]);
    sheet.mergeCells(`A${rowNumber}:D${rowNumber}`);
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    sheet.getCell(`E${rowNumber}`).font = { bold: true };
    sheet.getCell(`E${rowNumber}`).numFmt = '"Rp" #,##0.00';
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF263B5A" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(1).height = 32;

  sheet.columns = [
    { width: 30 },
    { width: 20 },
    { width: 23 },
    { width: 20 },
    { width: 30 },
  ];

  for (let rowNumber = 2; rowNumber <= dataEndRow; rowNumber++) {
    sheet.getCell(rowNumber, 2).numFmt = '#,##0';
    for (const column of [3, 4, 5]) {
      sheet.getCell(rowNumber, column).numFmt = '"Rp" #,##0.00';
    }
  }

  if (dataEndRow >= 1) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(dataEndRow, 1), column: 5 },
    };
  }

  return workbook.xlsx.writeBuffer();
}
module.exports = { getReport, createExcel };
