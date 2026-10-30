
const analyticsService = require("../services/analyticsService");

async function getAnalytics(req, res) {
    try {
        const { storeId, days = 7, startDate, endDate } = req.query;

        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: "storeId wajib diisi",
            });
        }

        if (Boolean(startDate) !== Boolean(endDate)) {
            return res.status(400).json({
                success: false,
                message: "startDate dan endDate harus diisi bersamaan",
            });
        }

        if (startDate && endDate) {
            const validDate = (value) =>
                /^\d{4}-\d{2}-\d{2}$/.test(value) &&
                !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
                new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

            if (!validDate(startDate) || !validDate(endDate)) {
                return res.status(400).json({
                    success: false,
                    message: "Format tanggal harus YYYY-MM-DD",
                });
            }

            if (startDate > endDate) {
                return res.status(400).json({
                    success: false,
                    message: "Tanggal mulai tidak boleh melewati tanggal akhir",
                });
            }
        }

        const analytics = await analyticsService.getAnalytics(
            storeId,
            days,
            startDate,
            endDate
        );

        return res.json({
            success: true,
            data: analytics,
        });
    } catch (error) {
        console.error("ANALYTICS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil analytics",
            error: error.message,
        });
    }
}

module.exports = { getAnalytics };
