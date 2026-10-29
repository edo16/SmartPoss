require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("./src/lib/prisma");

function hiddenInput(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";

    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Jalankan langsung dari Terminal interaktif."));
      return;
    }

    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      process.stdout.write("\n");
    }

    function onData(buffer) {
      for (const char of buffer.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Dibatalkan."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " " && char !== "\u007f") {
          value += char;
        }
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  const email = "admin@smartpos.com";

  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true, role: true, isActive: true }
  });

  if (!user || user.role !== "ADMIN" || !user.isActive) {
    throw new Error("Akun ADMIN aktif tidak ditemukan.");
  }

  const password = await hiddenInput("Password baru (minimal 8 karakter): ");
  if (password.length < 8) throw new Error("Password minimal 8 karakter.");

  const confirmation = await hiddenInput("Ulangi password baru: ");
  if (password !== confirmation) throw new Error("Password tidak cocok.");

  const hash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { email },
    data: { password: hash }
  });

  console.log("Berhasil! Password ADMIN sudah diperbarui.");
  console.log("Email:", email);
}

main()
  .catch(err => {
    console.error("\nGagal:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
