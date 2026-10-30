const reportService = require("../services/reportService");

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function getParams(req, res) {
  const { storeId, startDate, endDate } = req.query;

  if (!storeId || !startDate || !endDate) {
    res.status(400).json({
      success: false,
      message: "storeId, startDate, dan endDate wajib diisi",
    });
    return null;
  }

  if (!validDate(startDate) || !validDate(endDate)) {
    res.status(400).json({
      success: false,
      message: "Format tanggal harus YYYY-MM-DD",
    });
    return null;
  }

  if (startDate > endDate) {
    res.status(400).json({
      success: false,
      message: "Tanggal mulai tidak boleh melewati tanggal akhir",
    });
    return null;
  }

  const days = (
    new Date(`${endDate}T00:00:00Z`) -
    new Date(`${startDate}T00:00:00Z`)
  ) / 86400000 + 1;

  if (days > 3660) {
    res.status(400).json({
      success: false,
      message: "Rentang rekap maksimal 10 tahun",
    });
    return null;
  }

  return { storeId, startDate, endDate };
}

async function getReport(req, res) {
  try {
    const params = getParams(req, res);
    if (!params) return;

    const report = await reportService.getReport(
      params.storeId,
      params.startDate,
      params.endDate
    );

    return res.json({ success: true, data: report });
  } catch (error) {
    console.error("REPORT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil rekap",
    });
  }
}

async function exportReport(req, res) {
  try {
    const params = getParams(req, res);
    if (!params) return;

    const report = await reportService.getReport(
      params.storeId,
      params.startDate,
      params.endDate
    );

    const groupingMode = ["day", "week", "month", "year"].includes(req.query.groupingMode)
      ? req.query.groupingMode
      : "day";
    const buffer = await reportService.createExcel(report, groupingMode);
    const filename = `rekap-${groupingMode}-${params.startDate}-${params.endDate}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error("REPORT EXPORT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengekspor rekap Excel",
    });
  }
}

module.exports = { getReport, exportReport };
