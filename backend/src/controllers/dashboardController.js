const dashboardService = require("../services/dashboardService");

async function getDashboard(req, res) {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi",
      });
    }

    const dashboard = await dashboardService.getDashboard(
      storeId,
      {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      }
    );

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data dashboard",
      error: error.message,
    });
  }
}

module.exports = {
  getDashboard,
};