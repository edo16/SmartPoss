const userService = require("../services/userService");

function handleError(res, error) {
    if (error.code === "P2002") {
        return res.status(409).json({
            success: false,
            message: "Email sudah digunakan pengguna lain"
        });
    }

    const status = error.statusCode ||
        (/wajib diisi|harus berupa|tidak valid|terlalu panjang|Password|Role harus|kolom yang tidak diizinkan|Tidak ada perubahan|akun sendiri|Admin aktif terakhir/i.test(error.message || "")
            ? 400
            : /tidak ditemukan/i.test(error.message || "") ? 404 : 500);

    if (status === 500) console.error("USER MANAGEMENT ERROR:", error);

    return res.status(status).json({
        success: false,
        message: status === 500
            ? "Terjadi kesalahan saat mengelola pengguna"
            : error.message
    });
}

async function listUsers(req, res) {
    try {
        const data = await userService.listUsers();
        return res.json({ success: true, data });
    } catch (error) {
        return handleError(res, error);
    }
}

async function createUser(req, res) {
    try {
        const data = await userService.createUser(req.body || {});
        return res.status(201).json({
            success: true,
            message: "Pengguna berhasil ditambahkan",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function updateUser(req, res) {
    try {
        const data = await userService.updateUser(
            req.params.id,
            req.body || {},
            req.user.userId
        );

        return res.json({
            success: true,
            message: "Pengguna berhasil diperbarui",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = { listUsers, createUser, updateUser };
