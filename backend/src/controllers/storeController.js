const storeService = require("../services/storeService");

function handleError(res, error) {
    const message = error.message || "Permintaan profil toko gagal";
    const status = message.includes("tidak ditemukan") ? 404
        : message.includes("tidak valid") || message.includes("wajib diisi") ? 400
        : 500;

    if (status === 500) console.error("STORE PROFILE ERROR:", error);

    return res.status(status).json({
        success: false,
        message: status === 500 ? "Terjadi kesalahan saat memproses profil toko" : message
    });
}

async function getStore(req, res) {
    try {
        const data = await storeService.getStore(req.params.id);
        return res.json({
            success: true,
            message: "Profil toko berhasil diambil",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function updateStore(req, res) {
    try {
        const data = await storeService.updateStore(req.params.id, req.body || {});
        return res.json({
            success: true,
            message: "Profil toko berhasil diperbarui",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = { getStore, updateStore };
