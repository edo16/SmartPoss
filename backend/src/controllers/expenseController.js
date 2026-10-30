
const expenseService = require("../services/expenseService");

async function handle(res, action, successMessage, status = 200) {
  try {
    const data = await action();
    return res.status(status).json({
      success: true,
      message: successMessage,
      data,
    });
  } catch (error) {
    console.error("EXPENSE ERROR:", error);
    const notFound = error.message.includes("tidak ditemukan");

    return res.status(notFound ? 404 : 400).json({
      success: false,
      message: error.message || "Gagal memproses pengeluaran",
    });
  }
}

function getExpenses(req, res) {
  const { storeId, startDate, endDate } = req.query;

  return handle(
    res,
    () => expenseService.getExpenses(storeId, startDate, endDate),
    "Daftar pengeluaran berhasil diambil"
  );
}

function createExpense(req, res) {
  return handle(
    res,
    () => expenseService.createExpense(req.body),
    "Pengeluaran berhasil ditambahkan",
    201
  );
}

function updateExpense(req, res) {
  return handle(
    res,
    () => expenseService.updateExpense(req.params.id, req.body),
    "Pengeluaran berhasil diperbarui"
  );
}

function deleteExpense(req, res) {
  const { storeId } = req.query;

  return handle(
    res,
    () => expenseService.deleteExpense(req.params.id, storeId),
    "Pengeluaran berhasil dihapus"
  );
}

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};
