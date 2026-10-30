const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");

const ROLES = ["ADMIN", "MANAGER", "CASHIER"];

const publicFields = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true
};

function normalizeText(value, field, maxLength) {
    if (typeof value !== "string") {
        throw new Error(field + " harus berupa teks");
    }

    const result = value.trim();

    if (!result) throw new Error(field + " wajib diisi");
    if (result.length > maxLength) {
        throw new Error(field + " terlalu panjang");
    }

    return result;
}

function normalizeEmail(value) {
    const email = normalizeText(value, "Email", 254).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Format email tidak valid");
    }

    return email;
}

function validateRole(role) {
    if (!ROLES.includes(role)) {
        throw new Error("Role harus ADMIN, MANAGER, atau CASHIER");
    }
}

async function listUsers() {
    return prisma.user.findMany({
        select: publicFields,
        orderBy: { createdAt: "desc" }
    });
}

async function createUser(input) {
    const name = normalizeText(input.name, "Nama", 120);
    const email = normalizeEmail(input.email);

    if (typeof input.password !== "string" ||
        input.password.length < 8 ||
        input.password.length > 128) {
        throw new Error("Password wajib 8–128 karakter");
    }

    const role = input.role === undefined ? "CASHIER" : input.role;
    validateRole(role);

    const password = await bcrypt.hash(input.password, 12);

    return prisma.user.create({
        data: { name, email, password, role },
        select: publicFields
    });
}

async function updateUser(id, input, currentUserId) {
    if (!id) throw new Error("ID pengguna wajib diisi");

    const allowed = ["name", "email", "role", "isActive", "password"];
    const keys = Object.keys(input);

    if (keys.length === 0) throw new Error("Tidak ada perubahan pengguna");
    if (keys.some(key => !allowed.includes(key))) {
        throw new Error("Ada kolom yang tidak diizinkan");
    }

    const existing = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            role: true,
            isActive: true
        }
    });

    if (!existing) {
        const error = new Error("Pengguna tidak ditemukan");
        error.statusCode = 404;
        throw error;
    }

    const data = {};

    if (input.name !== undefined) {
        data.name = normalizeText(input.name, "Nama", 120);
    }

    if (input.email !== undefined) {
        data.email = normalizeEmail(input.email);
    }

    if (input.role !== undefined) {
        validateRole(input.role);

        if (id === currentUserId && input.role !== existing.role) {
            const error = new Error("Role akun sendiri tidak dapat diubah");
            error.statusCode = 400;
            throw error;
        }

        data.role = input.role;
    }

    if (input.isActive !== undefined) {
        if (typeof input.isActive !== "boolean") {
            throw new Error("Status aktif harus berupa boolean");
        }

        if (id === currentUserId && input.isActive === false) {
            const error = new Error("Akun sendiri tidak dapat dinonaktifkan");
            error.statusCode = 400;
            throw error;
        }

        data.isActive = input.isActive;
    }

    if (input.password !== undefined) {
        if (typeof input.password !== "string" ||
            input.password.length < 8 ||
            input.password.length > 128) {
            throw new Error("Password baru wajib 8–128 karakter");
        }

        data.password = await bcrypt.hash(input.password, 12);
    }

    const removesActiveAdmin =
        existing.role === "ADMIN" &&
        existing.isActive &&
        (
            data.role !== undefined && data.role !== "ADMIN" ||
            data.isActive === false
        );

    if (removesActiveAdmin) {
        const activeAdmins = await prisma.user.count({
            where: { role: "ADMIN", isActive: true }
        });

        if (activeAdmins <= 1) {
            const error = new Error("Admin aktif terakhir tidak dapat diturunkan role atau dinonaktifkan");
            error.statusCode = 400;
            throw error;
        }
    }

    if (Object.keys(data).length === 0) {
        throw new Error("Tidak ada perubahan pengguna");
    }

    return prisma.user.update({
        where: { id },
        data,
        select: publicFields
    });
}

module.exports = { listUsers, createUser, updateUser };
