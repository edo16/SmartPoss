const prisma = require("../lib/prisma");

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function lockOrder(tx, orderId, storeId) {
  const rows = await tx.$queryRaw`
    SELECT "id"
    FROM "Order"
    WHERE "id" = ${orderId}
      AND "storeId" = ${storeId}
    FOR UPDATE
  `;

  if (!rows.length) {
    fail("Transaksi tidak ditemukan di toko ini.", 404);
  }

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      refunds: true,
    },
  });

  if (!order) {
    fail("Transaksi tidak ditemukan.", 404);
  }

  return order;
}

function completedRefundTotal(refunds) {
  return money(
    refunds
      .filter((refund) => refund.status === "COMPLETED")
      .reduce((sum, refund) => sum + Number(refund.amount), 0)
  );
}

function reservedRefundTotal(refunds) {
  return money(
    refunds
      .filter((refund) =>
        refund.status === "PENDING" ||
        refund.status === "COMPLETED"
      )
      .reduce((sum, refund) => sum + Number(refund.amount), 0)
  );
}

async function withOrderLockRetry(callback) {
  // PostgreSQL dapat membatalkan transaksi serializable karena konflik.
  // Coba ulang konflik serialisasi yang dikenal Prisma.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error.code !== "P2034" || attempt === 2) {
        throw error;
      }
    }
  }
}

async function createRefund({
  storeId,
  orderId,
  amount,
  reason,
  requestedById,
}) {
  const requestedAmount = money(amount);

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    fail("Nominal refund harus lebih besar dari Rp0.");
  }

  const cleanReason = String(reason || "").trim();

  if (!cleanReason) {
    fail("Alasan refund wajib diisi.");
  }

  if (cleanReason.length > 500) {
    fail("Alasan refund maksimal 500 karakter.");
  }

  return withOrderLockRetry(async (tx) => {
    const order = await lockOrder(tx, orderId, storeId);

    if (
      order.status !== "COMPLETED" ||
      !order.payment ||
      order.payment.status !== "PAID"
    ) {
      fail("Refund hanya dapat diajukan untuk transaksi yang sudah dibayar dan selesai.");
    }

    const paymentAmount = money(order.payment.amount);
    const alreadyReserved = reservedRefundTotal(order.refunds);

    if (alreadyReserved + requestedAmount > paymentAmount + 0.001) {
      fail(
        `Nominal refund melebihi sisa yang tersedia. Maksimal Rp${money(
          paymentAmount - alreadyReserved
        ).toLocaleString("id-ID")}.`
      );
    }

    return tx.refund.create({
      data: {
        orderId: order.id,
        amount: requestedAmount,
        reason: cleanReason,
        status: "PENDING",
        requestedById,
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  });
}

async function confirmRefund({
  storeId,
  orderId,
  refundId,
  confirmedById,
}) {
  return withOrderLockRetry(async (tx) => {
    const order = await lockOrder(tx, orderId, storeId);

    const refund = await tx.refund.findFirst({
      where: {
        id: refundId,
        orderId: order.id,
      },
    });

    if (!refund) {
      fail("Catatan refund tidak ditemukan.", 404);
    }

    if (refund.status !== "PENDING") {
      fail("Hanya refund berstatus PENDING yang dapat dikonfirmasi.");
    }

    if (!order.payment) {
      fail("Data pembayaran transaksi tidak ditemukan.");
    }

    const completedBefore = completedRefundTotal(order.refunds);
    const newCompletedTotal = money(
      completedBefore + Number(refund.amount)
    );
    const paymentAmount = money(order.payment.amount);

    if (newCompletedTotal > paymentAmount + 0.001) {
      fail("Total refund melampaui nominal pembayaran.");
    }

    // Konfirmasi ini adalah pencatatan bahwa pengembalian uang
    // sudah benar-benar dilakukan oleh petugas yang berwenang.
    const updatedRefund = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "COMPLETED",
        confirmedById,
        completedAt: new Date(),
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, role: true },
        },
        confirmedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (newCompletedTotal >= paymentAmount - 0.001) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: { status: "REFUNDED" },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      });
    }

    return {
      refund: updatedRefund,
      completedRefundTotal: newCompletedTotal,
      paymentAmount,
      fullyRefunded: newCompletedTotal >= paymentAmount - 0.001,
    };
  });
}

async function cancelRefund({ storeId, orderId, refundId }) {
  return withOrderLockRetry(async (tx) => {
    const order = await lockOrder(tx, orderId, storeId);

    const refund = await tx.refund.findFirst({
      where: {
        id: refundId,
        orderId: order.id,
      },
    });

    if (!refund) {
      fail("Catatan refund tidak ditemukan.", 404);
    }

    if (refund.status !== "PENDING") {
      fail("Hanya refund PENDING yang dapat dibatalkan.");
    }

    return tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
  });
}

async function getRefunds({ storeId, orderId }) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      storeId,
    },
    select: { id: true },
  });

  if (!order) {
    fail("Transaksi tidak ditemukan di toko ini.", 404);
  }

  return prisma.refund.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: {
        select: { id: true, name: true, role: true },
      },
      confirmedBy: {
        select: { id: true, name: true, role: true },
      },
    },
  });
}

module.exports = {
  createRefund,
  confirmRefund,
  cancelRefund,
  getRefunds,
};
