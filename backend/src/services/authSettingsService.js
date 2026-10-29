const fs = require("fs/promises");
const path = require("path");

const settingsPath = path.resolve(__dirname, "../../data/auth-settings.json");

async function getAuthSettings() {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const settings = JSON.parse(raw);

    if (typeof settings.requiredLogin !== "boolean") {
      throw new Error("Pengaturan login tidak valid.");
    }

    return { requiredLogin: settings.requiredLogin };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { requiredLogin: false };
    }

    throw error;
  }
}

async function setRequiredLogin(requiredLogin) {
  if (typeof requiredLogin !== "boolean") {
    throw new Error("Nilai requiredLogin harus boolean.");
  }

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });

  const temporaryPath = `${settingsPath}.tmp`;
  await fs.writeFile(
    temporaryPath,
    JSON.stringify({ requiredLogin }, null, 2) + "\n",
    "utf8"
  );
  await fs.rename(temporaryPath, settingsPath);

  return { requiredLogin };
}

module.exports = {
  getAuthSettings,
  setRequiredLogin,
};
