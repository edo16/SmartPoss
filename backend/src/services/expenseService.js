
const prisma = require("../lib/prisma");

function normalizeExpense(expense) {
  return {
    ...expense,
    amount: Number(expense.amount),
  };
}

function parseDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} tidak valid`);
  }

  return date;
}

async function getExpenses(storeId, startDate, endDate) {
  if (!storeId) throw new Error("storeId wajib diisi");

  const where = { storeId };

  if (startDate || endDate) {
    where.expenseDate = {};

    if (startDate) {
      where.expenseDate.gte = parseDate(
        startDate,
        "Tanggal awal"
      );
    }

    if (endDate) {
      const end = parseDate(endDate, "Tanggal akhir");
      end.setDate(end.getDate() + 1);
      where.expenseDate.lt = end;
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: "desc" },
  });

  return expenses.map(normalizeExpense);
}

async function createExpense(data) {
  const {
    storeId,
    description,
    category,
    amount,
    expenseDate,
    dueDate,
    paymentStatus,
  } = data;

  if (!storeId) throw new Error("storeId wajib diisi");

  if (!description?.trim()) {
    throw new Error("Deskripsi pengeluaran wajib diisi");
  }

  const nominal = Number(amount);

  if (!Number.isFinite(nominal) || nominal <= 0) {
    throw new Error("Nominal pengeluaran harus lebih dari 0");
  }

  const status = paymentStatus || "UNPAID";

  if (!["UNPAID", "PAID"].includes(status)) {
    throw new Error("Status pembayaran tidak valid");
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true },
  });

  if (!store) throw new Error("Toko tidak ditemukan");

  const expense = await prisma.expense.create({
    data: {
      storeId,
      description: description.trim(),
      category: category?.trim() || null,
      amount: nominal,
      ...(expenseDate
        ? { expenseDate: parseDate(expenseDate, "Tanggal pengeluaran") }
        : {}),
      dueDate: parseDate(dueDate, "Tanggal tenggat"),
      paymentStatus: status,
    },
  });

  return normalizeExpense(expense);
}

async function updateExpense(id, data) {
  const {
    storeId,
    description,
    category,
    amount,
    expenseDate,
    dueDate,
    paymentStatus,
  } = data;

  if (!storeId) throw new Error("storeId wajib diisi");

  const existing = await prisma.expense.findFirst({
    where: { id, storeId },
  });

  if (!existing) throw new Error("Pengeluaran tidak ditemukan");

  const updateData = {};

  if (description !== undefined) {
    if (!description?.trim()) {
      throw new Error("Deskripsi wajib diisi");
    }

    updateData.description = description.trim();
  }

  if (category !== undefined) {
    updateData.category = category?.trim() || null;
  }

  if (amount !== undefined) {
    const nominal = Number(amount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      throw new Error("Nominal pengeluaran harus lebih dari 0");
    }

    updateData.amount = nominal;
  }

  if (expenseDate !== undefined) {
    updateData.expenseDate = parseDate(
      expenseDate,
      "Tanggal pengeluaran"
    );
  }

  if (dueDate !== undefined) {
    updateData.dueDate =
      dueDate === null || dueDate === ""
        ? null
        : parseDate(dueDate, "Tanggal tenggat");
  }

  if (paymentStatus !== undefined) {
    if (!["UNPAID", "PAID"].includes(paymentStatus)) {
      throw new Error("Status pembayaran tidak valid");
    }

    updateData.paymentStatus = paymentStatus;
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: updateData,
  });

  return normalizeExpense(expense);
}

async function deleteExpense(id, storeId) {
  if (!storeId) throw new Error("storeId wajib diisi");

  const existing = await prisma.expense.findFirst({
    where: { id, storeId },
    select: { id: true },
  });

  if (!existing) throw new Error("Pengeluaran tidak ditemukan");

  await prisma.expense.delete({ where: { id } });

  return { id };
}

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};
