const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new Error("Email atau password salah");
  }

  if (!user.isActive) {
    throw new Error("Akun tidak aktif");
  }

  const passwordMatch = await bcrypt.compare(
    password,
    user.password
  );

  if (!passwordMatch) {
    throw new Error("Email atau password salah");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  };
}


async function guestLogin() {
  const authSettingsService = require("./authSettingsService");
  const settings = await authSettingsService.getAuthSettings();

  if (settings.requiredLogin) {
    throw new Error("Login wajib aktif. Silakan login dengan akun Anda.");
  }

  const user = await prisma.user.findFirst({
    where: {
      role: "CASHIER",
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new Error(
      "Tidak ada akun kasir aktif untuk sesi otomatis. Aktifkan login dan periksa akun kasir."
    );
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      isGuest: true,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );

  return {
    token,
    user: {
      ...user,
      isGuest: true,
    },
  };
}

module.exports = {
  login,
  guestLogin,
};