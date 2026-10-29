const prisma = require("../lib/prisma");
const { getIO } = require("../lib/socket");

async function getPaymentById(paymentId) {
  return await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
          receipt: true,
        },
      },
      events: true,
    },
  });
}

async function markPaymentPaid(
  paymentId,
  paymentData = {}
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const payment =
        await tx.payment.findUnique({
          where: {
            id: paymentId,
          },
          include: {
            order: {
              include: {
                items: true,
              },
            },
          },
        });

      if (!payment) {
        throw new Error(
          "Payment tidak ditemukan"
        );
      }

      // ========================================
      // IDEMPOTENCY
      // ========================================

      if (payment.status === "PAID") {
        return {
          alreadyPaid: true,
          payment,
        };
      }

      if (payment.status !== "PENDING") {
        throw new Error(
          `Payment tidak dapat diproses karena status saat ini ${payment.status}`
        );
      }

      // ========================================
      // CASH VALIDATION
      // ========================================

      let cashReceived = null;
      let changeAmount = null;

      if (payment.method === "CASH") {
        cashReceived = Number(
          paymentData.cashReceived
        );

        if (!Number.isFinite(cashReceived)) {
          throw new Error(
            "Jumlah uang tunai wajib diisi"
          );
        }

        if (
          cashReceived <
          Number(payment.amount)
        ) {
          throw new Error(
            `Uang yang diterima kurang. Total pembayaran Rp${Number(
              payment.amount
            ).toLocaleString("id-ID")}`
          );
        }

        changeAmount =
          cashReceived -
          Number(payment.amount);
      }

      const order = payment.order;

      // ========================================
      // VALIDASI STOCK
      // ========================================

      const productIds =
        order.items.map(
          (item) => item.productId
        );

      const products =
        await tx.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
        });

      for (const item of order.items) {
        const product = products.find(
          (p) =>
            p.id === item.productId
        );

        if (!product) {
          throw new Error(
            `Product ${item.productId} tidak ditemukan`
          );
        }

        if (
          product.stock <
          item.quantity
        ) {
          throw new Error(
            `Stock ${product.name} tidak mencukupi`
          );
        }
      }

      // ========================================
      // UPDATE PAYMENT
      // ========================================

      const paidPayment =
        await tx.payment.update({
          where: {
            id: paymentId,
          },
          data: {
            status: "PAID",
            paidAt: new Date(),

            cashReceived,
            changeAmount,
          },
        });

      // ========================================
      // KURANGI STOCK
      // ========================================

      for (const item of order.items) {
        const product = products.find(
          (p) =>
            p.id === item.productId
        );

        const stockBefore =
          product.stock;

        const stockAfter =
          stockBefore -
          item.quantity;

        await tx.product.update({
          where: {
            id: product.id,
          },
          data: {
            stock: stockAfter,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: "SALE",
            quantity:
              -item.quantity,
            stockBefore,
            stockAfter,
            referenceId: order.id,
            notes: `Penjualan ${order.orderNumber}`,
          },
        });
      }

      // ========================================
      // SELESAIKAN ORDER
      // ========================================

      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: "COMPLETED",
        },
      });

      // ========================================
      // BUAT RECEIPT
      // ========================================

      const receiptNumber =
        `RCT-${Date.now()}`;

      const receipt =
        await tx.receipt.create({
          data: {
            orderId: order.id,
            receiptNumber,
            printedAt: null,
          },
        });

// ========================================
// MEMBER / LOYALTY POINTS
// ========================================

let pointsUsed = 0;
let pointsEarned = 0;
let newLoyaltyBalance = null;

if (order.customerId) {
  const customer =
    await tx.customer.findUnique({
      where: {
        id: order.customerId,
      },
    });

  if (!customer) {
    throw new Error(
      "Member transaksi tidak ditemukan"
    );
  }

  pointsUsed =
    Number(order.pointsUsed || 0);

  // Poin didapat:
  // Rp30.000 = 10 poin
  pointsEarned =
    Math.floor(
      Number(order.total) / 30000
    ) * 10;

  const currentPoints =
    Number(customer.loyaltyPoints || 0);

  if (pointsUsed > currentPoints) {
    throw new Error(
      "Poin member tidak mencukupi"
    );
  }

  newLoyaltyBalance =
    currentPoints -
    pointsUsed +
    pointsEarned;

  await tx.customer.update({
    where: {
      id: customer.id,
    },
    data: {
      loyaltyPoints:
        newLoyaltyBalance,

      totalSpent: {
        increment:
          Number(order.total),
      },
    },
  });

  // ------------------------------
  // RIWAYAT REDEEM
  // ------------------------------

  if (pointsUsed > 0) {
    const redeemBalance =
      currentPoints -
      pointsUsed;

    await tx.pointHistory.create({
      data: {
        customerId:
          customer.id,

        orderId:
          order.id,

        type:
          "REDEEM",

        points:
          -pointsUsed,

        balance:
          redeemBalance,

        description:
          `Penukaran ${pointsUsed} poin untuk diskon`,
      },
    });
  }

  // ------------------------------
  // RIWAYAT EARN
  // ------------------------------

  if (pointsEarned > 0) {
    await tx.pointHistory.create({
      data: {
        customerId:
          customer.id,

        orderId:
          order.id,

        type:
          "EARN",

        points:
          pointsEarned,

        balance:
          newLoyaltyBalance,

        description:
          `Poin dari transaksi ${order.orderNumber}`,
      },
    });
  }
}

      // ========================================
      // PAYMENT EVENT
      // ========================================

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,

          provider:
            payment.method === "CASH"
              ? "CASH_REGISTER"
              : "SIMULATOR",

          eventId:
            `${
              payment.method === "CASH"
                ? "CASH"
                : "SIM"
            }-${Date.now()}`,

          eventType:
            "PAYMENT_PAID",

          payload: {
            paymentId:
              payment.id,

            orderId:
              order.id,

            orderNumber:
              order.orderNumber,

            amount:
              Number(payment.amount),

            method:
              payment.method,

            cashReceived,

            changeAmount,

            status:
              "PAID",
          },

          processed: true,

          processedAt:
            new Date(),
        },
      });

      return {
        alreadyPaid: false,

        payment:
          paidPayment,

        order: {
          id: order.id,

          orderNumber:
            order.orderNumber,

          status:
            "COMPLETED",
        },

        receipt,
      };
    }
  );

  // ========================================
  // IDEMPOTENCY
  // ========================================

  if (result.alreadyPaid) {
    return result.payment;
  }

  // ========================================
  // SOCKET.IO
  // ========================================

  try {
    const io = getIO();

    io.emit(
      "payment:paid",
      {
        paymentId:
          result.payment.id,

        orderId:
          result.order.id,

        orderNumber:
          result.order.orderNumber,

        amount:
          Number(
            result.payment.amount
          ),

        method:
          result.payment.method,

        cashReceived:
          result.payment
            .cashReceived !== null
            ? Number(
                result.payment
                  .cashReceived
              )
            : null,

        changeAmount:
          result.payment
            .changeAmount !== null
            ? Number(
                result.payment
                  .changeAmount
              )
            : null,

        status:
          result.payment.status,

        paidAt:
          result.payment.paidAt,

        receiptNumber:
          result.receipt
            .receiptNumber,
      }
    );

    console.log(
      `📡 Socket emitted: payment:paid → ${result.order.orderNumber}`
    );
  } catch (socketError) {
    console.error(
      "⚠️ Socket emit gagal:",
      socketError.message
    );
  }

  return result;
}

// ========================================
// CASH PAYMENT
// ========================================

async function processCashPayment(
  paymentId,
  cashReceived
) {
  return await markPaymentPaid(
    paymentId,
    {
      cashReceived,
    }
  );
}

// ========================================
// COMPLETE PAYMENT
// ========================================

async function completePayment(
  paymentId
) {
  return await markPaymentPaid(
    paymentId
  );
}

// ========================================
// CANCEL PENDING PAYMENT
// ========================================

async function cancelPendingPayment(paymentId) {
  return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { order: true },
      });

      if (!payment) {
          throw new Error("Payment tidak ditemukan");
      }

      if (payment.status === "CANCELLED") {
          return { alreadyCancelled: true, payment };
      }

      if (payment.status !== "PENDING") {
          throw new Error(
              `Pembayaran tidak bisa dibatalkan karena statusnya ${payment.status}`
          );
      }

      if (
          payment.order &&
          payment.order.status !== "PENDING"
      ) {
          throw new Error(
              `Pesanan tidak bisa dibatalkan karena statusnya ${payment.order.status}`
          );
      }

      const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: { status: "CANCELLED" },
      });

      if (payment.order) {
          await tx.order.update({
              where: { id: payment.order.id },
              data: { status: "CANCELLED" },
          });
      }

      return {
          cancelled: true,
          payment: updatedPayment,
      };
  });
}


module.exports = {
  getPaymentById,
  markPaymentPaid,
  processCashPayment,
  completePayment,
  cancelPendingPayment,
};