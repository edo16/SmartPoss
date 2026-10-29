const fs = require("fs");
const path = require("path");
const express = require("express");

const uploadMiddleware = express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: "2mb"
});

const uploadDir = path.resolve(__dirname, "../../uploads/payments");
const extensions = ["png", "jpg", "webp"];

function imageFile(ext) {
    return path.join(uploadDir, "qris." + ext);
}

function currentImage() {
    for (const ext of extensions) {
        if (fs.existsSync(imageFile(ext))) {
            return "/uploads/payments/qris." + ext;
        }
    }
    return null;
}

function detectImage(buffer) {
    if (!Buffer.isBuffer(buffer)) return null;

    if (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        )
    ) return "png";

    if (
        buffer.length >= 3 &&
        buffer[0] === 255 &&
        buffer[1] === 216 &&
        buffer[2] === 255
    ) return "jpg";

    if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) return "webp";

    return null;
}

function getQrisImage(req, res) {
    return res.json({
        success: true,
        data: { qrisImageUrl: currentImage() }
    });
}

function uploadQrisImage(req, res) {
    let tempFile = null;

    try {
        const ext = detectImage(req.body);

        if (!ext) {
            return res.status(400).json({
                success: false,
                message: "Gunakan gambar PNG, JPEG, atau WebP yang valid."
            });
        }

        fs.mkdirSync(uploadDir, { recursive: true });

        const destination = imageFile(ext);
        tempFile = path.join(
            uploadDir,
            "qris-upload-" + Date.now() + ".tmp"
        );

        fs.writeFileSync(tempFile, req.body, { flag: "wx" });
        fs.renameSync(tempFile, destination);
        tempFile = null;

        for (const oldExt of extensions) {
            if (oldExt !== ext && fs.existsSync(imageFile(oldExt))) {
                fs.unlinkSync(imageFile(oldExt));
            }
        }

        return res.json({
            success: true,
            message: "Gambar QRIS berhasil disimpan.",
            data: { qrisImageUrl: currentImage() }
        });
    } catch (error) {
        if (tempFile && fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
            } catch (_) {}
        }

        console.error("UPLOAD QRIS IMAGE:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal menyimpan gambar QRIS."
        });
    }
}

function deleteQrisImage(req, res) {
    try {
        for (const ext of extensions) {
            const file = imageFile(ext);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }

        return res.json({
            success: true,
            message: "Gambar QRIS berhasil dihapus.",
            data: { qrisImageUrl: null }
        });
    } catch (error) {
        console.error("DELETE QRIS IMAGE:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal menghapus gambar QRIS."
        });
    }
}

module.exports = {
    uploadMiddleware,
    getQrisImage,
    uploadQrisImage,
    deleteQrisImage
};
