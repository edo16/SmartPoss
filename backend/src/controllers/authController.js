const authService = require("../services/authService");
const authSettingsService = require("../services/authSettingsService");

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi",
      });
    }

    const settings = await authSettingsService.getAuthSettings();

    if (!settings.requiredLogin) {
      return res.status(403).json({
        success: false,
        message: "Login tidak diwajibkan saat ini.",
      });
    }

    const result = await authService.login(email, password);

    return res.json({
      success: true,
      message: "Login berhasil",
      data: result,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);

    return res.status(401).json({
      success: false,
      message: error.message || "Login gagal.",
    });
  }
}

async function getSettings(req, res) {
  try {
    const settings = await authSettingsService.getAuthSettings();

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("AUTH SETTINGS ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Pengaturan login gagal dibaca.",
    });
  }
}

async function updateSettings(req, res) {
  try {
    const { requiredLogin } = req.body || {};

    if (typeof requiredLogin !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "requiredLogin harus bernilai true atau false.",
      });
    }

    const settings = await authSettingsService.setRequiredLogin(requiredLogin);

    return res.json({
      success: true,
      message: requiredLogin
        ? "Login wajib berhasil diaktifkan."
        : "Login wajib berhasil dinonaktifkan.",
      data: settings,
    });
  } catch (error) {
    console.error("UPDATE AUTH SETTINGS ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Pengaturan login gagal disimpan.",
    });
  }
}

async function enableLogin(req, res) {
  try {
    const settings = await authSettingsService.setRequiredLogin(true);

    return res.json({
      success: true,
      message: "Login wajib berhasil diaktifkan.",
      data: settings,
    });
  } catch (error) {
    console.error("ENABLE LOGIN ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login wajib gagal diaktifkan.",
    });
  }
}

async function guestLogin(req, res) {
  try {
    const result = await authService.guestLogin();

    return res.json({
      success: true,
      message: "Sesi kasir otomatis berhasil dibuat.",
      data: result,
    });
  } catch (error) {
    console.error("GUEST LOGIN ERROR:", error.message);

    return res.status(403).json({
      success: false,
      message: error.message || "Sesi otomatis tidak dapat dibuat.",
    });
  }
}

module.exports = {
  login,
  getSettings,
  updateSettings,
  enableLogin,
  guestLogin,
};
