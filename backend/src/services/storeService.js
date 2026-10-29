const prisma = require("../lib/prisma");

const STORE_FIELDS = ["name", "address", "phone", "email"];

async function getStore(id) {
    if (!id) throw new Error("ID toko wajib diisi");

    const store = await prisma.store.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
            createdAt: true,
            updatedAt: true
        }
    });

    if (!store) throw new Error("Toko tidak ditemukan");
    return store;
}

async function updateStore(id, input) {
    if (!id) throw new Error("ID toko wajib diisi");

    const existing = await prisma.store.findUnique({
        where: { id },
        select: { id: true }
    });

    if (!existing) throw new Error("Toko tidak ditemukan");

    const data = {};

    for (const field of STORE_FIELDS) {
        if (input[field] === undefined) continue;

        if (typeof input[field] !== "string") {
            throw new Error(`Kolom ${field} tidak valid`);
        }

        const value = input[field].trim();

        if (field === "name" && !value) {
            throw new Error("Nama toko wajib diisi");
        }

        const maxLength = {
            name: 120,
            address: 500,
            phone: 30,
            email: 254
        }[field];

        if (value.length > maxLength) {
            throw new Error(`Kolom ${field} tidak valid: terlalu panjang`);
        }

        if (field === "email" && value &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error("Format email tidak valid");
        }

        data[field] = value || (field === "name" ? "" : null);
    }

    if (Object.keys(data).length === 0) {
        throw new Error("Tidak ada perubahan profil toko");
    }

    const store = await prisma.store.update({
        where: { id },
        data,
        select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
            createdAt: true,
            updatedAt: true
        }
    });

    return store;
}

module.exports = { getStore, updateStore };
