// SmartPOS Backend

const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const express = require("express");
const cors = require("cors");
const http = require("http");

const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const paymentSettingsRoutes = require("./routes/paymentSettingsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const reportRoutes = require("./routes/reportRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const customerRoutes = require("./routes/customerRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const storeRoutes = require("./routes/storeRoutes");
const brandingRoutes = require("./routes/brandingRoutes");
const backupRoutes = require("./routes/backupRoutes");

const { initSocket } = require("./lib/socket");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// Routes
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payment-settings", paymentSettingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/branding", brandingRoutes);
app.use("/api/backup", backupRoutes);

// Root
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SmartPOS API is running 🚀",
  });
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SmartPOS backend is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
========================================
🚀 SmartPOS Backend
========================================
Server : http://localhost:${PORT}
Health : http://localhost:${PORT}/api/health
Socket : Enabled
========================================
  `);
});
