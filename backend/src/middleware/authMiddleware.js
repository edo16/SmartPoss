const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const authSettingsService = require("../services/authSettingsService");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token diperlukan",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "Format token tidak valid",
      });
    }

    const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Token tidak valid",
      });
    }

    if (decoded.isGuest === true) {
      const settings = await authSettingsService.getAuthSettings();

      if (settings.requiredLogin) {
        return res.status(401).json({
          success: false,
          message: "Login wajib aktif. Silakan login kembali.",
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Akun tidak ditemukan atau sudah tidak aktif",
      });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      isGuest: decoded.isGuest === true,
    };

    return next();
  } catch (error) {
    if (
      error.name !== "JsonWebTokenError" &&
      error.name !== "TokenExpiredError" &&
      error.name !== "NotBeforeError"
    ) {
      console.error("AUTH ERROR:", error.message);

      return res.status(500).json({
        success: false,
        message: "Autentikasi gagal diproses",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah expired",
    });
  }
}

module.exports = authMiddleware;
