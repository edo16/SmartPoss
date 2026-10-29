
const fs = require("fs");
const path = require("path");
const express = require("express");
const prisma = require("../lib/prisma");

const uploadMiddleware = express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: "2mb"
});

const uploadDir = path.resolve(__dirname, "../../uploads/stores");
const extensions = ["png", "jpg", "webp"];

function storeFile(id, ext) {
    return path.join(uploadDir, id + "." + ext);
}

function safeId(id) {
    return typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
}

function detectImage(buffer) {
    if (!Buffer.isBuffer(buffer)) return null;
    if (buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
    if (buffer.length >= 3 &&
        buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "jpg";
    if (buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
    return null;
}

function currentStoreLogo(id) {
    for (const ext of extensions) {
        if (fs.existsSync(storeFile(id, ext))) {
            return "/uploads/stores/" + id + "." + ext;
        }
    }
    return null;
}

async function getStoreLogo(req, res) {
    try {
        const id = req.params.id;
        if (!safeId(id)) return res.status(400).json({ success: false, message: "ID toko tidak valid" });

        const store = await prisma.store.findUnique({ where: { id }, select: { id: true } });
        if (!store) return res.status(404).json({ success: false, message: "Toko tidak ditemukan" });

        return res.json({ success: true, data: { logoUrl: currentStoreLogo(id) } });
    } catch (error) {
        console.error("GET STORE LOGO:", error);
        return res.status(500).json({ success: false, message: "Gagal mengambil logo toko" });
    }
}

async function uploadStoreLogo(req, res) {
    try {
        const id = req.params.id;
        if (!safeId(id)) return res.status(400).json({ success: false, message: "ID toko tidak valid" });

        const store = await prisma.store.findUnique({ where: { id }, select: { id: true } });
        if (!store) return res.status(404).json({ success: false, message: "Toko tidak ditemukan" });

        const ext = detectImage(req.body);
        if (!ext) return res.status(400).json({ success: false, message: "Gunakan gambar PNG, JPEG, atau WebP yang valid" });

        fs.mkdirSync(uploadDir, { recursive: true });
        for (const oldExt of extensions) {
            const oldPath = storeFile(id, oldExt);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        fs.writeFileSync(storeFile(id, ext), req.body, { flag: "wx" });
        return res.json({
            success: true,
            message: "Logo toko berhasil diunggah",
            data: { logoUrl: currentStoreLogo(id) }
        });
    } catch (error) {
        console.error("UPLOAD STORE LOGO:", error);
        return res.status(500).json({ success: false, message: "Gagal menyimpan logo toko" });
    }
}

async function deleteStoreLogo(req, res) {
    try {
        const id = req.params.id;
        if (!safeId(id)) return res.status(400).json({ success: false, message: "ID toko tidak valid" });

        const store = await prisma.store.findUnique({ where: { id }, select: { id: true } });
        if (!store) return res.status(404).json({ success: false, message: "Toko tidak ditemukan" });

        for (const ext of extensions) {
            const file = storeFile(id, ext);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        return res.json({ success: true, message: "Logo toko dihapus", data: { logoUrl: null } });
    } catch (error) {
        console.error("DELETE STORE LOGO:", error);
        return res.status(500).json({ success: false, message: "Gagal menghapus logo toko" });
    }
}


const appLogoDir = path.resolve(__dirname, "../../uploads/branding");

function appLogoFile(ext) {
    return path.join(appLogoDir, "app." + ext);
}

function currentAppLogo() {
    for (const ext of extensions) {
        if (fs.existsSync(appLogoFile(ext))) {
            return "/uploads/branding/app." + ext;
        }
    }
    return null;
}

async function getAppLogo(req, res) {
    return res.json({
        success: true,
        data: { logoUrl: currentAppLogo() }
    });
}

async function uploadAppLogo(req, res) {
    try {
        const ext = detectImage(req.body);
        if (!ext) {
            return res.status(400).json({
                success: false,
                message: "Gunakan gambar PNG, JPEG, atau WebP yang valid"
            });
        }

        fs.mkdirSync(appLogoDir, { recursive: true });

        for (const oldExt of extensions) {
            const oldPath = appLogoFile(oldExt);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        fs.writeFileSync(appLogoFile(ext), req.body, { flag: "wx" });

        return res.json({
            success: true,
            message: "Logo SmartPOS berhasil diperbarui",
            data: { logoUrl: currentAppLogo() }
        });
    } catch (error) {
        console.error("UPLOAD APP LOGO:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal menyimpan logo SmartPOS"
        });
    }
}

async function resetAppLogo(req, res) {
    try {
        for (const ext of extensions) {
            const oldPath = appLogoFile(ext);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        return res.json({
            success: true,
            message: "Logo SmartPOS dikembalikan ke tampilan bawaan",
            data: { logoUrl: null }
        });
    } catch (error) {
        console.error("RESET APP LOGO:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mereset logo SmartPOS"
        });
    }
}


const identityFile = path.resolve(__dirname, "../../uploads/branding/identity.json");

function readAppIdentity() {
    const defaults = { appName: "SmartPOS", appSubtitle: "Point of Sale" };
    try {
        if (!fs.existsSync(identityFile)) return defaults;
        const saved = JSON.parse(fs.readFileSync(identityFile, "utf8"));
        return {
            appName: typeof saved.appName === "string" ? saved.appName : defaults.appName,
            appSubtitle: typeof saved.appSubtitle === "string" ? saved.appSubtitle : defaults.appSubtitle
        };
    } catch (error) {
        console.error("READ APP IDENTITY:", error);
        return defaults;
    }
}

function getAppIdentity(req, res) {
    return res.json({ success: true, data: readAppIdentity() });
}

function updateAppIdentity(req, res) {
    try {
        const appName = typeof req.body?.appName === "string" ? req.body.appName.trim() : "";
        const appSubtitle = typeof req.body?.appSubtitle === "string" ? req.body.appSubtitle.trim() : "";

        if (!appName || !appSubtitle) {
            return res.status(400).json({
                success: false,
                message: "Nama aplikasi dan subtitle wajib diisi."
            });
        }
        if (appName.length > 40 || appSubtitle.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Nama maksimal 40 karakter dan subtitle maksimal 60 karakter."
            });
        }

        fs.mkdirSync(path.dirname(identityFile), { recursive: true });
        const tempFile = identityFile + ".tmp";
        fs.writeFileSync(tempFile, JSON.stringify({ appName, appSubtitle }, null, 2), "utf8");
        fs.renameSync(tempFile, identityFile);

        return res.json({
            success: true,
            message: "Identitas aplikasi berhasil disimpan.",
            data: { appName, appSubtitle }
        });
    } catch (error) {
        console.error("UPDATE APP IDENTITY:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal menyimpan identitas aplikasi."
        });
    }
}

module.exports = {
    uploadMiddleware,
    getStoreLogo,
    uploadStoreLogo,
    deleteStoreLogo,
    getAppLogo,
    uploadAppLogo,
    resetAppLogo,
    getAppIdentity,
    updateAppIdentity
};
