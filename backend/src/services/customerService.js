const prisma = require("../lib/prisma");

async function getCustomers(storeId, search = "") {
  if (!storeId) {
    throw new Error("storeId wajib diisi");
  }

  const keyword = search.trim();

  const customers = await prisma.customer.findMany({
    where: {
      storeId,
      ...(keyword
        ? {
            OR: [
              {
                name: {
                  contains: keyword,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: keyword,
                  mode: "insensitive",
                },
              },
              {
                memberCode: {
                  contains: keyword,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      memberCode: true,
      name: true,
      phone: true,
      email: true,
      loyaltyPoints: true,
      totalSpent: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return customers.map((customer) => ({
    ...customer,
    totalSpent: Number(customer.totalSpent),
  }));
}

async function getCustomerById(storeId, customerId) {
  if (!storeId) {
    throw new Error("storeId wajib diisi");
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      storeId,
    },
    include: {
      pointHistory: {
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      },
    },
  });

  if (!customer) {
    throw new Error("Member tidak ditemukan");
  }

  return {
    ...customer,
    totalSpent: Number(customer.totalSpent),
    pointHistory: customer.pointHistory.map((history) => ({
      ...history,
      points: Number(history.points),
      balance: Number(history.balance),
    })),
  };
}

async function generateMemberCode(storeId) {
  const lastCustomer = await prisma.customer.findFirst({
    where: {
      storeId,
    },
    orderBy: {
      memberCode: "desc",
    },
    select: {
      memberCode: true,
    },
  });

  let nextNumber = 1;

  if (lastCustomer?.memberCode) {
    const number = Number(
      lastCustomer.memberCode.replace("MBR-", "")
    );

    if (Number.isFinite(number)) {
      nextNumber = number + 1;
    }
  }

  return `MBR-${String(nextNumber).padStart(6, "0")}`;
}

async function createCustomer(data) {
  const {
    storeId,
    name,
    phone,
    email,
  } = data;

  if (!storeId) {
    throw new Error("storeId wajib diisi");
  }

  if (!name || !name.trim()) {
    throw new Error("Nama member wajib diisi");
  }

  const cleanName = name.trim();
  const cleanPhone = phone?.trim() || null;
  const cleanEmail = email?.trim() || null;

  if (cleanPhone) {
    const existingPhone = await prisma.customer.findFirst({
      where: {
        storeId,
        phone: cleanPhone,
      },
    });

    if (existingPhone) {
      throw new Error(
        "Nomor HP sudah terdaftar sebagai member"
      );
    }
  }

  const memberCode = await generateMemberCode(storeId);

  const customer = await prisma.customer.create({
    data: {
      storeId,
      memberCode,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      loyaltyPoints: 0,
      totalSpent: 0,
    },
  });

  return {
    ...customer,
    totalSpent: Number(customer.totalSpent),
  };
}


async function updateCustomer(data) {
  const { id, storeId, name, phone, email } = data;

  if (!id) throw new Error("ID member wajib diisi");
  if (!storeId) throw new Error("storeId wajib diisi");
  if (!name || !name.trim()) {
    throw new Error("Nama member wajib diisi");
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: { id, storeId },
  });

  if (!existingCustomer) {
    throw new Error("Member tidak ditemukan");
  }

  const cleanName = name.trim();
  const cleanPhone = phone?.trim() || null;
  const cleanEmail = email?.trim() || null;

  if (cleanPhone) {
    const duplicatePhone = await prisma.customer.findFirst({
      where: {
        storeId,
        phone: cleanPhone,
        id: { not: id },
      },
    });

    if (duplicatePhone) {
      throw new Error("Nomor HP sudah digunakan member lain");
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
    },
  });

  return {
    ...customer,
    totalSpent: Number(customer.totalSpent),
  };
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
};