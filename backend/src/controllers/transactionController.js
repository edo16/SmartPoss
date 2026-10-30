const transactionService = require("../services/transactionService");

async function getTransactions(req, res) {
  try {
    const {
      storeId,
      search,
      date,
      paymentMethod,
      status,
    } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi",
      });
    }

    const result =
      await transactionService.getTransactions(
        storeId,
        {
          search,
          date,
          paymentMethod,
          status,
        }
      );

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "TRANSACTIONS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Gagal mengambil transaksi",
      error: error.message,
    });
  }
}

async function getTransactionById(req, res) {
  try {
    const { storeId } = req.query;
    const { id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi",
      });
    }

    const transaction =
      await transactionService.getTransactionById(
        storeId,
        id
      );

    res.json({
      success: true,
      data: transaction,
    });

  } catch (error) {
    console.error(
      "TRANSACTION DETAIL ERROR:",
      error
    );

    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getTransactions,
  getTransactionById,
};