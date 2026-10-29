/* =========================================================
   SMARTPOS FRONTEND
   ========================================================= */

   const API_URL = "http://localhost:5000";
   const STORE_ID = "smartpos-demo-store";

   let products = [];
   let cart = [];
   let selectedCustomer = null;
   let selectedPointsToRedeem = 0;

   let selectedPaymentMethod = "CASH";
   let currentPayment = null;

   let revenueChart = null;
   let countdownInterval = null;

   let inventoryProducts = [];
   let inventoryCategory = "ALL";
   let deletedInventoryProducts = [];
   let inventoryTrashMode = false;
   let editingProductId = null;

   let transactions = [];
   let filteredTransactions = [];


   /* =========================================================
      PRODUCT EMOJI
      ========================================================= */

   const productEmoji = {
       "Kopi Susu": "☕",
       "Es Jeruk": "🍊",
       "Es Teh": "🍵",
       "Nasi Goreng": "🍳",
       "Bakso": "🍲",
       "Mie Ayam": "🍜"
   };


   /* =========================================================
      CATEGORY EMOJI
      ========================================================= */

   const categoryEmoji = {
       Minuman: "🥤",
       Makanan: "🍜"
   };


   /* =========================================================
      AUTH
      ========================================================= */

   let token = localStorage.getItem("smartpos_token");

async function fetchAuthSettings() {
    const response = await fetch(`${API_URL}/api/auth/settings`);
    const result = await response.json();

    if (!response.ok || !result.success ||
        typeof result.data?.requiredLogin !== "boolean") {
        throw new Error("Pengaturan login tidak dapat diperiksa.");
    }

    return result.data;
}

async function createGuestSession() {
    const response = await fetch(`${API_URL}/api/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
    });
    const result = await response.json();

    if (!response.ok || !result.success || !result.data?.token) {
        throw new Error(result.message || "Sesi kasir otomatis gagal dibuat.");
    }

    token = result.data.token;
    localStorage.setItem("smartpos_token", token);
    localStorage.setItem("smartpos_user", JSON.stringify(result.data.user));
}




/* =========================================
   LOGIN FORM AND USER PROFILE
   ========================================= */
function showLoginScreen(message = "") {
    document.body.classList.add("auth-required");
    const screen = document.getElementById("loginScreen");
    const error = document.getElementById("loginError");
    if (screen) screen.setAttribute("aria-hidden", "false");
    if (error) {
        error.textContent = message;
        error.hidden = !message;
    }
}

function hideLoginScreen() {
    document.body.classList.remove("auth-required");
    const screen = document.getElementById("loginScreen");
    if (screen) screen.setAttribute("aria-hidden", "true");
}

function getStoredUser() {
    try {
        const value = localStorage.getItem("smartpos_user");
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
}

function renderCurrentUser(user) {
    const name = user?.name || user?.fullName || user?.username || "Pengguna";
    const rawRole = user?.role || "Pengguna aktif";
    const roleLabels = {
        ADMIN: "Administrator",
        MANAGER: "Manajer",
        CASHIER: "Kasir"
    };
    const role = roleLabels[String(rawRole).toUpperCase()] || rawRole;

    const avatar = document.getElementById("currentUserAvatar");
    const nameEl = document.getElementById("currentUserName");
    const roleEl = document.getElementById("currentUserRole");

    if (avatar) avatar.textContent = String(name).trim().charAt(0).toUpperCase() || "U";
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
}

function setupLoginUi() {
    const form = document.getElementById("loginForm");
    const logout = document.getElementById("logoutButton");

    if (form && form.dataset.bound !== "true") {
        form.dataset.bound = "true";
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const email = document.getElementById("loginEmail")?.value.trim();
            const password = document.getElementById("loginPassword")?.value;
            const button = document.getElementById("loginSubmit");
            const error = document.getElementById("loginError");

            if (error) {
                error.hidden = true;
                error.textContent = "";
            }
            if (button) {
                button.disabled = true;
                button.textContent = "Memeriksa...";
            }

            try {
                const data = await login(email, password);
                if (data.user) {
                    localStorage.setItem("smartpos_user", JSON.stringify(data.user));
                } else {
                    localStorage.removeItem("smartpos_user");
                }
                window.location.reload();
            } catch (err) {
                showLoginScreen(err.message || "Login gagal. Periksa email dan password.");
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = "Masuk";
                }
            }
        });
    }

    const settingsLogout = document.getElementById("settingsLogoutButton");

    if (settingsLogout && settingsLogout.dataset.bound !== "true") {
        settingsLogout.dataset.bound = "true";
        settingsLogout.addEventListener("click", () => {
            localStorage.removeItem("smartpos_token");
            localStorage.removeItem("smartpos_user");
            token = null;
            window.location.reload();
        });
    }
}

async function login(email, password) {

       const response = await fetch(
           `${API_URL}/api/auth/login`,
           {
               method: "POST",
               headers: {
                   "Content-Type": "application/json"
               },
               body: JSON.stringify({ email, password })
           }
       );

       const result = await response.json();

       if (!response.ok || !result.success) {
           throw new Error(result.message || "Login gagal");
       }

       token = result.data.token;
       localStorage.setItem("smartpos_token", token);

       return result.data;
   }


   /* =========================================================
      API HELPER
      ========================================================= */

   async function apiFetch(
       endpoint,
       options = {},
       retry = true
   ) {

       // Selalu ambil token terbaru dari localStorage.
       token = localStorage.getItem("smartpos_token");

       const headers = {
           ...(options.headers || {})
       };


       if (token) {

           headers.Authorization =
               `Bearer ${token}`;

       }


       if (
           options.body &&
           !headers["Content-Type"]
       ) {

           headers["Content-Type"] =
               "application/json";

       }


       const response = await fetch(
           `${API_URL}${endpoint}`,
           {
               ...options,
               headers
           }
       );


       /* =====================================================
          TOKEN EXPIRED
          ===================================================== */

       if (response.status === 401) {
           localStorage.removeItem("smartpos_token");
           localStorage.removeItem("smartpos_user");
           token = null;
           throw new Error(
               "Sesi berakhir atau belum login. Silakan login kembali."
           );
       }


       let result;


       try {

           result =
               await response.json();

       } catch {

           throw new Error(
               "Response server tidak valid"
           );

       }


       if (
           !response.ok ||
           result.success === false
       ) {

           throw new Error(
               result.message ||
               "Request gagal"
           );

       }


       return result;
   }


   /* =========================================================
      FORMAT RUPIAH
      ========================================================= */

   function formatRupiah(value) {

       const number =
           Number(value) || 0;


       return new Intl.NumberFormat(
           "id-ID",
           {
               style: "currency",
               currency: "IDR",
               maximumFractionDigits: 0
           }
       ).format(number);
   }


   /* =========================================================
      ESCAPE HTML
      ========================================================= */

   function escapeHtml(value) {

       return String(value ?? "")
           .replaceAll("&", "&amp;")
           .replaceAll("<", "&lt;")
           .replaceAll(">", "&gt;")
           .replaceAll('"', "&quot;")
           .replaceAll("'", "&#039;");
   }


   /* =========================================================
      PRODUCT EMOJI HELPER
      ========================================================= */

   function getProductEmoji(product) {

       if (
           product &&
           product.name &&
           productEmoji[product.name]
       ) {

           return productEmoji[
               product.name
           ];

       }


       if (
           product &&
           product.category &&
           categoryEmoji[product.category]
       ) {

           return categoryEmoji[
               product.category
           ];

       }


       return "🍽️";
   }


   /* =========================================================
      LOAD PRODUCTS
      ========================================================= */

   async function loadProducts() {

       try {

           const result =
               await apiFetch(
                   `/api/products?storeId=${STORE_ID}`
               );


           products =
               Array.isArray(result.data)
                   ? result.data
                   : [];


           renderProducts();


       } catch (error) {

           console.error(
               "LOAD PRODUCTS ERROR:",
               error
           );


           const grid =
               document.getElementById(
                   "productGrid"
               );


           if (grid) {

               grid.innerHTML = `
                   <div class="loading">
                       Gagal memuat produk.
                       <br>
                       ${escapeHtml(
                           error.message
                       )}
                   </div>
               `;

           }

       }

   }


   /* =========================================================
      RENDER PRODUCTS
      ========================================================= */

   function renderProducts() {

       const grid =
           document.getElementById(
               "productGrid"
           );


       if (!grid) return;


       const searchInput =
           document.getElementById(
               "searchProduct"
           );


       const search =
           (
               searchInput?.value ||
               ""
           )
               .trim()
               .toLowerCase();


       const activeCategory =
           document.querySelector(
               ".category-btn.active"
           )?.dataset.category ||
           "ALL";


       const filtered =
           products.filter(
               product => {

                   const name =
                       String(
                           product.name || ""
                       ).toLowerCase();


                   const matchesSearch =
                       name.includes(search);


                   const matchesCategory =
                       activeCategory === "ALL" ||
                       product.category ===
                           activeCategory;


                   return (
                       matchesSearch &&
                       matchesCategory
                   );

               }
           );


       const productCount =
           document.getElementById(
               "productCount"
           );


       if (productCount) {

           productCount.textContent =
               `${filtered.length} produk`;

       }


       if (!filtered.length) {

           grid.innerHTML = `
               <div class="loading">
                   Produk tidak ditemukan.
               </div>
           `;

           return;
       }


       grid.innerHTML =
           filtered
               .map(product => {

                   const cartItem =
                       cart.find(
                           item =>
                               String(
                                   item.productId
                               ) ===
                               String(
                                   product.id
                               )
                       );


                   const quantity =
                       cartItem?.quantity || 0;


                   const stock =
                       Number(
                           product.stock
                       ) || 0;


                   let stockClass = "";


                   if (stock <= 0) {

                       stockClass = "empty";

                   } else if (stock <= 10) {

                       stockClass = "low";

                   }


                   return `
                       <div
                           class="
                               product-card
                               ${stock <= 0 ? "disabled" : ""}
                           "
                           data-product-id="${escapeHtml(
                               product.id
                           )}"
                       >

                           ${
                               quantity > 0
                                   ? `
                                       <div class="product-quantity">
                                           ${quantity}
                                       </div>
                                   `
                                   : ""
                           }

                           <div class="product-image">

                               <div class="product-emoji">
                                   ${getProductEmoji(
                                       product
                                   )}
                               </div>

                           </div>

                           <div class="product-info">

                               <h4>
                                   ${escapeHtml(
                                       product.name
                                   )}
                               </h4>

                               <div class="product-price">
                                   ${formatRupiah(
                                       product.sellingPrice
                                   )}
                               </div>

                               <div class="product-meta">

                                   <span class="product-category">
                                       ${escapeHtml(
                                           product.category ||
                                           "Menu"
                                       )}
                                   </span>

                                   <span
                                       class="
                                           product-stock
                                           ${stockClass}
                                       "
                                   >
                                       ${
                                           stock <= 0
                                               ? "Habis"
                                               : `Stock: ${stock}`
                                       }
                                   </span>

                               </div>

                           </div>

                       </div>
                   `;

               })
               .join("");
   }


   /* =========================================================
      ADD TO CART
      ========================================================= */

   function addToCart(productId) {

       const product =
           products.find(
               item =>
                   String(item.id) ===
                   String(productId)
           );


       if (!product) return;


       const stock =
           Number(product.stock) || 0;


       if (stock <= 0) {

           showToast(
               "Stok produk habis",
               "error"
           );

           return;
       }


       const existing =
           cart.find(
               item =>
                   String(item.productId) ===
                   String(productId)
           );


       if (existing) {

           if (
               existing.quantity >=
               stock
           ) {

               showToast(
                   "Jumlah melebihi stok",
                   "error"
               );

               return;
           }


           existing.quantity += 1;


       } else {

           cart.push({

               productId:
                   product.id,

               name:
                   product.name,

               price:
                   Number(
                       product.sellingPrice
                   ),

               quantity:
                   1,

               emoji:
                   getProductEmoji(
                       product
                   )

           });

       }


       renderProducts();
       renderCart();
   }


   /* =========================================================
      DECREASE CART
      ========================================================= */

   function decreaseCart(productId) {

       const item =
           cart.find(
               item =>
                   String(item.productId) ===
                   String(productId)
           );


       if (!item) return;


       item.quantity -= 1;


       if (item.quantity <= 0) {

           cart =
               cart.filter(
                   item =>
                       String(
                           item.productId
                       ) !==
                       String(productId)
               );

       }


       renderProducts();
       renderCart();
   }


   /* =========================================================
      INCREASE CART
      ========================================================= */

   function increaseCart(productId) {

       const item =
           cart.find(
               item =>
                   String(item.productId) ===
                   String(productId)
           );


       const product =
           products.find(
               product =>
                   String(product.id) ===
                   String(productId)
           );


       if (!item || !product) return;


       const stock =
           Number(product.stock) || 0;


       if (
           item.quantity >=
           stock
       ) {

           showToast(
               "Jumlah sudah mencapai stok",
               "error"
           );

           return;
       }


       item.quantity += 1;


       renderProducts();
       renderCart();
   }


   /* =========================================================
      RENDER CART
      ========================================================= */

   function renderCart() {

       const container =
           document.getElementById(
               "cartItems"
           );


       if (!container) return;


       const cartCount =
           cart.reduce(
               (sum, item) =>
                   sum + item.quantity,
               0
           );


       const cartCountElement =
           document.getElementById(
               "cartCount"
           );


       if (cartCountElement) {

           cartCountElement.textContent =
               cartCount;

       }


       if (!cart.length) {

           container.innerHTML = `
               <div class="empty-cart">

                   <div class="empty-cart-icon">
                       🛒
                   </div>

                   <h4>
                       Belum ada pesanan
                   </h4>

                   <p>
                       Klik produk untuk
                       menambahkannya
                   </p>

               </div>
           `;


           updateSummary();

           return;
       }


       container.innerHTML =
           cart
               .map(item => {

                   const subtotal =
                       item.price *
                       item.quantity;


                   return `
                       <div class="cart-item">

                           <div class="cart-item-emoji">
                               ${item.emoji}
                           </div>

                           <div class="cart-item-info">

                               <strong>
                                   ${escapeHtml(
                                       item.name
                                   )}
                               </strong>

                               <small>
                                   ${formatRupiah(
                                       item.price
                                   )}
                               </small>

                               <div class="quantity-controls">

                                   <button
                                       type="button"
                                       data-action="decrease"
                                       data-id="${escapeHtml(
                                           item.productId
                                       )}"
                                   >
                                       −
                                   </button>

                                    <input
                                        type="number"
                                        class="cart-quantity-input"
                                        data-id="${escapeHtml(item.productId)}"
                                        value="${item.quantity}"
                                        min="1"
                                        max="${Number(
                                            products.find(
                                                product =>
                                                    String(product.id) === String(item.productId)
                                            )?.stock
                                        ) || 1}"
                                        step="1"
                                        aria-label="Jumlah ${escapeHtml(item.name)}"
                                    />

                                   <button
                                       type="button"
                                       data-action="increase"
                                       data-id="${escapeHtml(
                                           item.productId
                                       )}"
                                   >
                                       +
                                   </button>

                               </div>

                           </div>

                           <div class="cart-item-total">
                               ${formatRupiah(
                                   subtotal
                               )}
                           </div>

                       </div>
                   `;

               })
               .join("");


       updateSummary();
   }


   /* =========================================================
      CALCULATE SUBTOTAL
      ========================================================= */

   function calculateSubtotal() {

       return cart.reduce(
           (sum, item) =>
               sum +
               item.price *
               item.quantity,
           0
       );
   }


   /* =========================================================
      UPDATE SUMMARY
      ========================================================= */

function getPercentageInputValue(id) {
    const input = document.getElementById(id);
    if (!input) return 0;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
}

function updateSummary() {
    const subtotal = calculateSubtotal();
    const discountPercent = getPercentageInputValue("discountPercentInput");
    const taxPercent = getPercentageInputValue("taxPercentInput");
    const discount = Math.round(subtotal * discountPercent) / 100;

    const redeemToggle = document.getElementById("redeemPointsToggle");
    const pointsDiscount =
        selectedCustomer &&
        redeemToggle?.checked === true &&
        selectedPointsToRedeem >= 100
            ? (selectedPointsToRedeem / 100) * 10000
            : 0;

    const taxBase = Math.max(0, subtotal - discount - pointsDiscount);
    const tax = Math.round(taxBase * taxPercent) / 100;
    const total = Math.max(0, subtotal - discount - pointsDiscount + tax);

    const subtotalElement = document.getElementById("subtotal");
    const discountElement = document.getElementById("discount");
    const taxElement = document.getElementById("tax");
    const totalElement = document.getElementById("total");
    const checkoutButton = document.getElementById("checkoutBtn");

    if (subtotalElement) subtotalElement.textContent = formatRupiah(subtotal);
    if (discountElement) discountElement.textContent =
        formatRupiah(discount + pointsDiscount);
    if (taxElement) taxElement.textContent = formatRupiah(tax);
    if (totalElement) totalElement.textContent = formatRupiah(total);
    if (checkoutButton) checkoutButton.disabled = cart.length === 0;
}


   /* =========================================================
      CLEAR CART
      ========================================================= */

   function clearCart() {

       if (!cart.length) return;


       cart = [];


       renderProducts();
       renderCart();
   }


   /* =========================================================
      PAYMENT METHOD
      ========================================================= */

   function setPaymentMethod(method) {

       selectedPaymentMethod =
           method;


       document
           .querySelectorAll(
               ".cart-payment-button"
           )
           .forEach(button => {

               button.classList.toggle(
                   "active",
                   button.dataset.payment ===
                       method
               );

           });
   }


   /* =========================================================
      CHECKOUT
      ========================================================= */


async function checkout() {
    if (window.smartposCheckoutProcessing) return;

    if (!cart.length) {
        showToast("Keranjang masih kosong", "error");
        return;
    }

    const checkoutButton = document.getElementById("checkoutBtn");
    if (!checkoutButton) return;

    window.smartposCheckoutProcessing = true;
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Membuat transaksi...";

    try {
        const result = await apiFetch("/api/orders", {
            method: "POST",
            body: JSON.stringify({
                storeId: STORE_ID,
                customerName: selectedCustomer
                    ? null
                    : (
                        document
                            .getElementById("checkoutCustomerName")
                            ?.value.trim() || null
                    ),
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                })),
                discountPercent: getPercentageInputValue("discountPercentInput"),
                discount: 0,
                customerId: selectedCustomer?.id || null,
                pointsUsed: (
                    selectedCustomer &&
                    document.getElementById("redeemPointsToggle")?.checked === true
                ) ? (selectedPointsToRedeem || 0) : 0,
                taxPercent: getPercentageInputValue("taxPercentInput"),
                tax: 0,
                serviceCharge: 0,
                paymentMethod: selectedPaymentMethod
            })
        });


        const order = result.data;

        if (!order?.payment?.id) {
            throw new Error("Data pembayaran tidak ditemukan.");
        }

        // Simpan snapshot transaksi sebelum cart dikosongkan.
        window.smartposReceiptData = {
            orderNumber: order.orderNumber || "-",
            date: new Date().toLocaleString("id-ID"),
            customerName:
                selectedCustomer?.name ||
                selectedCustomer?.customerName ||
                document.getElementById("checkoutCustomerName")?.value.trim() ||
                "Pelanggan Umum",
            items: cart.map(item => ({
                name: item.name || "Produk",
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 0
            })),
            subtotal: Number(order.subtotal) || 0,
            discount: Number(order.discount) || 0,
            pointsDiscount: Number(order.pointsDiscount) || 0,
            tax: Number(order.tax) || 0,
            serviceCharge: Number(order.serviceCharge) || 0,
            discountPercent: getPercentageInputValue("discountPercentInput"),
            taxPercent: getPercentageInputValue("taxPercentInput"),
            total: Number(order.total) || 0,
            method: selectedPaymentMethod,
            cashReceived: 0,
            changeAmount: 0
        };

        currentPayment = order.payment;
        openPaymentModal(order);


        checkoutButton.textContent = "Menunggu pembayaran...";
    } catch (error) {
        console.error("CHECKOUT ERROR:", error);
        showToast(error.message || "Gagal membuat transaksi", "error");

        window.smartposCheckoutProcessing = false;
        checkoutButton.disabled = cart.length === 0;
        checkoutButton.textContent = "Bayar Sekarang";
    }
}



   /* =========================================================
      PAYMENT MODAL
      ========================================================= */

   function openPaymentModal(order) {

       const modal =
           document.getElementById(
               "paymentModal"
           );


       if (!modal) return;


       modal.classList.remove(
           "hidden"
       );


       const paymentOrder =
           document.getElementById(
               "paymentOrder"
           );


       const paymentAmount =
           document.getElementById(
               "paymentAmount"
           );


       if (paymentOrder) {

           paymentOrder.textContent =
               order.orderNumber;

       }


       if (paymentAmount) {

           paymentAmount.textContent =
               formatRupiah(
                   order.total
               );

       }


       const cashPanel =
           document.getElementById(
               "cashPaymentPanel"
           );


       const qrisPanel =
           document.getElementById(
               "qrisPaymentPanel"
           );


       cashPanel?.classList.add(
           "hidden"
       );


       qrisPanel?.classList.add(
           "hidden"
       );


       if (
           selectedPaymentMethod ===
           "CASH"
       ) {

           cashPanel?.classList.remove(
               "hidden"
           );


           setupCashPayment(
               order
           );


       } else {

           qrisPanel?.classList.remove(
               "hidden"
           );


           setupQRIS(
               order
           );

       }
   }


/* =========================================================
   CLOSE PAYMENT
   ========================================================= */

async function closePaymentModal(cancelPending = false) {
    const payment = currentPayment;

    // Batalkan pembayaran pending jika modal ditutup manual.
    if (cancelPending && payment?.id) {
        try {
            await apiFetch(
                `/api/payments/${payment.id}/cancel`,
                {
                    method: "POST"
                }
            );
        } catch (error) {
            console.error(
                "CANCEL PAYMENT ERROR:",
                error
            );

            showToast(
                error.message || "Gagal membatalkan pembayaran",
                "error"
            );

            return;
        }
    }

    document
        .getElementById("paymentModal")
        ?.classList.add("hidden");

    clearInterval(countdownInterval);
    countdownInterval = null;

    // Aktifkan kembali checkout hanya untuk penutupan manual.
    if (cancelPending) {
        currentPayment = null;

        window.smartposCheckoutProcessing = false;

        const checkoutButton =
            document.getElementById("checkoutBtn");

        if (checkoutButton) {
            checkoutButton.disabled = cart.length === 0;
            checkoutButton.textContent = "Bayar Sekarang";
        }

        showToast(
            "Pembayaran dibatalkan. Keranjang tetap tersimpan.",
            "info"
        );
    }
}


   /* =========================================================
      CASH PAYMENT
      ========================================================= */

   function setupCashPayment(order) {

       const input =
           document.getElementById(
               "cashReceived"
           );


       const change =
           document.getElementById(
               "changeAmount"
           );


       const button =
           document.getElementById(
               "cashPayBtn"
           );


       if (!input || !change || !button) {
           return;
       }


       input.value = "";


       change.textContent =
           formatRupiah(0);


       button.disabled = true;


       function updateCash() {

           const received =
               Number(
                   input.value
               ) || 0;


           const total =
               Number(
                   order.total
               ) || 0;


           if (received >= total) {

               const changeAmount =
                   received -
                   total;


               change.textContent =
                   formatRupiah(
                       changeAmount
                   );


               button.disabled =
                   false;


           } else {

               change.textContent =
                   formatRupiah(0);


               button.disabled =
                   true;

           }

       }


       input.oninput =
           updateCash;


       document
           .querySelectorAll(
               ".quick-cash button"
           )
           .forEach(button => {

               button.onclick =
                   () => {

                       if (
                           button.dataset.cash ===
                           "exact"
                       ) {

                           input.value =
                               Number(
                                   order.total
                               );

                       } else {

                           input.value =
                               button.dataset.cash;

                       }


                       updateCash();

                   };

           });


       button.onclick =
           () =>
               processCashPayment(
                   order
               );
   }


   /* =========================================================
      PROCESS CASH
      ========================================================= */

   async function processCashPayment(order) {

       const input =
           document.getElementById(
               "cashReceived"
           );


       if (!input) return;


       const received =
           Number(
               input.value
           );


       if (
           !Number.isFinite(received) ||
           received <= 0
       ) {

           showToast(
               "Masukkan jumlah uang yang valid",
               "error"
           );

           return;
       }


       const total =
           Number(
               order.total
           ) || 0;


       if (received < total) {

           showToast(
               "Uang pembayaran kurang",
               "error"
           );

           return;
       }


       const button =
           document.getElementById(
               "cashPayBtn"
           );


       if (!button) return;


       button.disabled = true;


       button.textContent =
           "Memproses...";


       try {

           const result =
               await apiFetch(
                   `/api/payments/${order.payment.id}/cash`,
                   {
                       method: "POST",

                       body:
                           JSON.stringify({
                               cashReceived:
                                   received
                           })
                   }
               );


           handlePaymentPaid(
               result.data
           );


       } catch (error) {

           console.error(
               "CASH PAYMENT ERROR:",
               error
           );


           showToast(
               error.message,
               "error"
           );


           button.disabled =
               false;


           button.textContent =
               "Konfirmasi Pembayaran";

       }
   }


   /* =========================================================
      QRIS
      ========================================================= */


   async function loadQrisImageForPOS() {
       const image = document.getElementById("qrisMerchantImage");
       const empty = document.getElementById("qrisImageEmpty");
       if (!image || !empty) return;

       image.hidden = true;
       empty.hidden = false;
       empty.textContent = "Memuat QRIS toko...";

       try {
           const response = await fetch(`${API_URL}/api/payment-settings/qris`);
           const result = await response.json();

           if (!response.ok || result.success !== true) {
               throw new Error("Gambar QRIS toko gagal dimuat.");
           }

           const url = result.data?.qrisImageUrl;
           if (!url) {
               empty.textContent = "QRIS toko belum diunggah. Silakan hubungi pengelola toko.";
               return;
           }

           image.onload = () => {
               image.hidden = false;
               empty.hidden = true;
           };

           image.onerror = () => {
               image.hidden = true;
               empty.hidden = false;
               empty.textContent = "Gambar QRIS gagal ditampilkan.";
           };

           const imageUrl = /^https?:\/\//i.test(url)
               ? url
               : API_URL + (url.startsWith("/") ? url : "/" + url);
           image.src = imageUrl + "?v=" + Date.now();
       } catch (error) {
           empty.hidden = false;
           empty.textContent = error.message || "Gambar QRIS gagal dimuat.";
       }
   }

   function setupQRIS(order) {
       void loadQrisImageForPOS();

       const qrisCode =
           document.getElementById(
               "qrisCode"
           );


       const paymentStatus =
           document.getElementById(
               "paymentStatus"
           );


       const paymentStatusBox =
           document.getElementById(
               "paymentStatusBox"
           );


       if (qrisCode) {

           qrisCode.textContent =
               `QRIS-${order.orderNumber}`;

       }


       if (paymentStatus) {

           paymentStatus.textContent =
               "Menunggu pembayaran...";

       }


       if (paymentStatusBox) {

           paymentStatusBox.className =
               "payment-status pending";

       }


       startCountdown(
           5 * 60
       );


       const simulateButton =
           document.getElementById(
               "simulatePayment"
           );


       if (simulateButton) {

           simulateButton.disabled =
               false;


           simulateButton.textContent =
               "Simulate QRIS Payment";


           simulateButton.onclick =
               () =>
                   simulateQRISPayment(
                       order
                   );

       }
   }


   /* =========================================================
      QRIS SIMULATOR
      ========================================================= */

   async function simulateQRISPayment(order) {

       const button =
           document.getElementById(
               "simulatePayment"
           );


       if (!button) return;


       button.disabled =
           true;


       button.textContent =
           "Memproses pembayaran...";


       try {

           const result =
               await apiFetch(
                   `/api/payments/${order.payment.id}/simulate-paid`,
                   {
                       method: "POST"
                   }
               );


           handlePaymentPaid(
               result.data
           );


       } catch (error) {

           console.error(
               "QRIS ERROR:",
               error
           );


           showToast(
               error.message,
               "error"
           );


           button.disabled =
               false;


           button.textContent =
               "Simulate QRIS Payment";

       }
   }


   /* =========================================================
      COUNTDOWN
      ========================================================= */

   function startCountdown(seconds) {

       clearInterval(
           countdownInterval
       );


       let remaining =
           Number(seconds) || 0;


       function render() {

           const countdown =
               document.getElementById(
                   "countdown"
               );


           if (!countdown) return;


           const minutes =
               Math.floor(
                   remaining / 60
               );


           const secs =
               remaining % 60;


           countdown.textContent =
               `${String(
                   minutes
               ).padStart(
                   2,
                   "0"
               )}:${String(
                   secs
               ).padStart(
                   2,
                   "0"
               )}`;

       }


       render();


       countdownInterval =
           setInterval(
               () => {

                   remaining--;


                   render();


                   if (
                       remaining <= 0
                   ) {

                       clearInterval(
                           countdownInterval
                       );


                       countdownInterval =
                           null;


                       const status =
                           document.getElementById(
                               "paymentStatus"
                           );


                       if (status) {

                           status.textContent =
                               "Pembayaran kedaluwarsa";

                       }

                   }

               },
               1000
           );
   }

   /* cetak struk POS */

   async function printPOSReceipt() {
    const data = window.smartposReceiptData;
    const receiptSettings = window.getReceiptSettings();

    if (!data) {
        showToast("Data struk tidak ditemukan.", "error");
        return;
    }

    const cashInput = document.getElementById("cashReceived");
    const cashReceived =
        Number(data.cashReceived) ||
        Number(cashInput?.value) ||
        0;

    const changeAmount =
        Number(data.changeAmount) ||
        Math.max(0, cashReceived - Number(data.total || 0));

    const rupiah = value => formatRupiah(Number(value) || 0);

    const itemsHTML = data.items.map(item => `
        <div class="item">
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-detail">
                <span>${item.quantity} × ${rupiah(item.price)}</span>
                <strong>${rupiah(item.quantity * item.price)}</strong>
            </div>
        </div>
    `).join("");

    const receiptSubtotal = Number(data.subtotal) ||
        data.items.reduce((sum, item) =>
            sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    const receiptDiscount = Number(data.discount) || 0;
    const receiptPointsDiscount = Number(data.pointsDiscount) || 0;
    const receiptTax = Number(data.tax) || 0;
    const receiptServiceCharge = Number(data.serviceCharge) || 0;

    const formatReceiptPercent = value =>
        Number((Number(value) || 0).toFixed(2)).toString();

    const receiptDiscountPercent =
        data.discountPercent !== undefined && data.discountPercent !== null
            ? Number(data.discountPercent) || 0
            : receiptSubtotal > 0
                ? receiptDiscount / receiptSubtotal * 100
                : 0;

    const receiptTaxBase = Math.max(
        0,
        receiptSubtotal - receiptDiscount - receiptPointsDiscount
    );

    const receiptTaxPercent =
        data.taxPercent !== undefined && data.taxPercent !== null
            ? Number(data.taxPercent) || 0
            : receiptTaxBase > 0
                ? receiptTax / receiptTaxBase * 100
                : 0;

    const summaryRows = [
        ["Subtotal", receiptSubtotal],
        [
            receiptDiscount
                ? `Diskon (${formatReceiptPercent(receiptDiscountPercent)}%)`
                : "Diskon",
            -receiptDiscount
        ],
        ["Diskon Poin", -receiptPointsDiscount],
        [
            receiptTax
                ? `Pajak (${formatReceiptPercent(receiptTaxPercent)}%)`
                : "Pajak",
            receiptTax
        ],
        ["Biaya Layanan", receiptServiceCharge]
    ].filter((row, index) => index === 0 || row[1] !== 0)
     .map(row => `
        <div class="meta-row">
            <span>${row[0]}</span>
            <strong>${row[1] < 0 ? "- " : ""}${rupiah(Math.abs(row[1]))}</strong>
        </div>
     `).join("");

    const summaryHTML = `<div class="receipt-summary">${summaryRows}</div>`;

    const isCash = String(data.method).toUpperCase() === "CASH";

    const printWindow = window.open("", "_blank", "width=420,height=700");

    if (!printWindow) {
        showToast("Popup cetak diblokir browser.", "error");
        return;
    }

    let storeProfile = {};
    let storeLogoUrl = "";

    try {
        const storeResult = await apiFetch(
            "/api/stores/" + encodeURIComponent(STORE_ID)
        );

        if (storeResult && storeResult.success && storeResult.data) {
            storeProfile = storeResult.data;
        }

        try {
            const logoResult = await apiFetch(
                "/api/stores/" + encodeURIComponent(STORE_ID) + "/logo"
            );

            storeLogoUrl =
                logoResult && logoResult.success && logoResult.data
                    ? (logoResult.data.logoUrl || "")
                    : "";
        } catch (logoError) {
            console.warn("Logo toko tidak dapat dimuat:", logoError);
        }
    } catch (profileError) {
        console.warn("Profil toko tidak dapat dimuat:", profileError);
    }

    const receiptStoreName =
        String(receiptSettings.storeName || "").trim() ||
        storeProfile.name || "SmartPOS";
    const receiptStoreAddress =
        String(receiptSettings.storeAddress || "").trim() ||
        storeProfile.address || "";
    const receiptStorePhone =
        String(receiptSettings.storePhone || "").trim() ||
        storeProfile.phone || "";

    const receiptLogoHTML = !receiptSettings.showLogo
        ? ""
        : storeLogoUrl
            ? '<img class="receipt-logo" src="' +
                escapeHtml(logoImageUrl(storeLogoUrl)) +
                '" alt="Logo toko">'
            : '<div class="brand-mark">S</div>';

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Struk ${escapeHtml(data.orderNumber)}</title>
            <style>
                @page { size: ${receiptSettings.paperSize}mm auto; margin: 0; }
                * { box-sizing: border-box; }
                html, body {
                    width: ${receiptSettings.paperSize}mm;
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    color: #171717;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 10px;
                    line-height: 1.4;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                body { padding: 4mm 3.5mm; }
                .receipt { width: 100%; }
                .brand { text-align: center; padding-bottom: 1mm; }
                .receipt-logo {
                    display: block;
                    width: 42px;
                    height: 42px;
                    max-width: 100%;
                    object-fit: contain;
                    margin: 0 auto 3px;
                }
                .brand-mark {
                    width: 28px; height: 28px; margin: 0 auto 3px;
                    border: 1.5px solid #171717; border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 15px; font-weight: 800;
                }
                h1 {
                    margin: 0; font-size: 17px; line-height: 1.1;
                    font-weight: 800; letter-spacing: 1px;
                }
                .tagline {
                    margin: 3px 0 0; font-size: 8px;
                    font-weight: 400; letter-spacing: normal;
                }
                .customer { padding-top: 2mm; }
                .customer-label {
                    color: #555; font-size: 7px;
                    text-transform: uppercase; letter-spacing: .7px;
                }
                .customer-name { font-size: 9px; font-weight: 600; overflow-wrap: anywhere; }
                .divider { border: 0; border-top: 1px dashed #777; margin: 3mm 0; }
                .section-label {
                    margin: 0 0 2mm; font-size: 8px;
                    font-weight: 700; letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .meta-row, .item-detail, .total-row {
                    display: flex; justify-content: space-between;
                    align-items: flex-start; gap: 8px; margin: 1.5mm 0;
                }
                .meta-row span, .item-detail span { color: #555; }
                .meta-row strong, .item-detail strong { text-align: right; overflow-wrap: anywhere; }
                .item { padding: 2mm 0; border-bottom: 1px dashed #ddd; break-inside: avoid; }
                .item-name { font-weight: 600; overflow-wrap: anywhere; }
                .item-detail { font-size: 9px; }
                .total-row {
                    margin-top: 3mm; padding: 3mm 0;
                    border-top: 1.5px solid #171717;
                    border-bottom: 1.5px solid #171717;
                    font-size: 12px; font-weight: 800;
                }
                .payment { padding-top: 2mm; }
                .footer { text-align: center; padding-top: 2mm; }
                .thanks { font-size: 10px; font-weight: 800; margin: 0 0 1mm; }
                .footer p { font-size: 7px; color: #555; margin: .5mm 0; }
                .brand-footer { margin-top: 1.5mm; font-size: 7px; font-weight: 700; letter-spacing: 1px; }
                .receipt-print-toolbar {
                    width: 100%;
                    max-width: 420px;
                    margin: 12px auto;
                    padding: 10px;
                    text-align: center;
                    font-family: Arial, Helvetica, sans-serif;
                }
                .receipt-print-toolbar button {
                    padding: 10px 18px;
                    border: 0;
                    border-radius: 8px;
                    background: #166534;
                    color: #fff;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                }
                @media screen {
                    body { margin: 12px auto; box-shadow: 0 2px 18px rgba(0,0,0,.12); }
                }
                @media print {
                    .receipt-print-toolbar { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="receipt-print-toolbar">
                <button type="button" onclick="window.focus(); window.print();">Cetak Struk</button>
            </div>
            <main class="receipt">
                <header class="brand">
                    ${receiptLogoHTML}
                    <h1>${escapeHtml(receiptStoreName)}</h1>
                    ${receiptSettings.showAddress && receiptStoreAddress ? '<p class="tagline">' + escapeHtml(receiptStoreAddress) + '</p>' : ""}
                    ${receiptSettings.showPhone && receiptStorePhone ? '<p class="tagline">' + escapeHtml(receiptStorePhone) + '</p>' : ""}
                    ${receiptSettings.showCustomer ? `
                        <div class="customer">
                            <div class="customer-label">Pelanggan</div>
                            <div class="customer-name">${escapeHtml(data.customerName || "Pelanggan Umum")}</div>
                        </div>
                    ` : ""}
                </header>

                <hr class="divider">

                <section>
                    <p class="section-label">Informasi Transaksi</p>
                    <div class="meta-row"><span>No. Pesanan</span><strong>${escapeHtml(data.orderNumber)}</strong></div>
                    <div class="meta-row"><span>Tanggal</span><strong>${escapeHtml(data.date)}</strong></div>
                </section>

                <hr class="divider">

                <section>
                    <p class="section-label">Rincian Belanja</p>
                    ${itemsHTML}
                    ${summaryHTML}
                    <div class="total-row">
                        <span>TOTAL</span>
                        <strong>${rupiah(data.total)}</strong>
                    </div>
                </section>

                <section class="payment">
                    <p class="section-label">Pembayaran</p>
                    <div class="meta-row"><span>Metode</span><strong>${escapeHtml(data.method || "-")}</strong></div>
                    ${isCash ? `
                        <div class="meta-row"><span>Uang Diterima</span><strong>${rupiah(cashReceived)}</strong></div>
                        <div class="meta-row"><span>Kembalian</span><strong>${rupiah(changeAmount)}</strong></div>
                    ` : ""}
                </section>

                <hr class="divider">

                <footer class="footer">
                    <p class="thanks">Terima Kasih!</p>
                    ${receiptSettings.footerMessage ? '<p class="receipt-custom-footer">' + escapeHtml(receiptSettings.footerMessage).replace(/\n/g, "<br>") + '</p>' : ""}
                    <p>Simpan struk ini sebagai bukti transaksi.</p>
                    <div class="brand-footer">${escapeHtml(receiptStoreName)}</div>
                </footer>
            </main>

            <script>
                window.onload = function () {
                    setTimeout(function () {
                        window.focus();
                        window.print();
                    }, 350);
                };
                window.onafterprint = function () { window.close(); };
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

   /* =========================================================
      PAYMENT PAID
      ========================================================= */

   function handlePaymentPaid(payment) {

        if (payment?.payment) {
        const result = payment;

        payment = {
            ...result.payment,
            order: result.order || result.payment.order || {},
            receipt: result.receipt || result.payment.receipt || {},
            receiptNumber:
                result.receipt?.receiptNumber ||
                result.payment.receiptNumber ||
                "-"
        };
    }

       clearInterval(
           countdownInterval
       );


       countdownInterval =
           null;


       const order =
           payment?.order ||
           {};

           const successCustomer = document.getElementById("successCustomer");

           if (successCustomer) {
               successCustomer.textContent =
                   window.smartposReceiptData?.customerName ||
                   "Pelanggan Umum";
           }

           if (window.smartposReceiptData) {
            const cashInput = document.getElementById("cashReceived");

            window.smartposReceiptData.method =
                payment.method || selectedPaymentMethod;

            window.smartposReceiptData.total =
                Number(payment.amount) ||
                window.smartposReceiptData.total;

            window.smartposReceiptData.cashReceived =
                Number(payment.cashReceived) ||
                Number(cashInput?.value) ||
                0;

            window.smartposReceiptData.changeAmount =
                Number(payment.changeAmount) || 0;

            window.smartposReceiptData.orderNumber =
                order.orderNumber ||
                payment.orderNumber ||
                window.smartposReceiptData.orderNumber;
        }

       const successOrder =
           document.getElementById(
               "successOrder"
           );


       const successAmount =
           document.getElementById(
               "successAmount"
           );


       const successMethod =
           document.getElementById(
               "successMethod"
           );


       const successChange =
           document.getElementById(
               "successChange"
           );


       const successReceipt =
           document.getElementById(
               "successReceipt"
           );


       if (successOrder) {

           successOrder.textContent =
               order.orderNumber ||
               payment.orderNumber ||
               "-";

       }


       if (successAmount) {

           successAmount.textContent =
               formatRupiah(
                   payment.amount
               );

       }


       if (successMethod) {

           successMethod.textContent =
               payment.method ||
               selectedPaymentMethod;

       }


       if (successChange) {

           successChange.textContent =
               formatRupiah(
                   payment.changeAmount ||
                   0
               );

       }


       if (successReceipt) {

           successReceipt.textContent =
               payment.receiptNumber ||
               payment.receipt?.receiptNumber ||
               "-";

       }


       closePaymentModal();


       document
           .getElementById(
               "successModal"
           )
           ?.classList.remove(
               "hidden"
           );

        currentPayment = null;

        // Reset tombol pembayaran tunai.
        const cashPayButton = document.getElementById("cashPayBtn");

        if (cashPayButton) {
            cashPayButton.disabled = false;
            cashPayButton.textContent = "Konfirmasi Pembayaran";
        }

        // Lepaskan pengunci checkout.
        window.smartposCheckoutProcessing = false;

        const checkoutButton = document.getElementById("checkoutBtn");

        if (checkoutButton) {
            checkoutButton.disabled = true;
            checkoutButton.textContent = "Bayar Sekarang";
        }

        // Kosongkan nama untuk pelanggan berikutnya.
        const customerNameInput = document.getElementById("checkoutCustomerName");

        if (customerNameInput) {
            customerNameInput.value = "";
        }

        cart = [];

       renderProducts();
       renderCart();


       /* =====================================================
          REFRESH DATA
          ===================================================== */

       loadProducts();
       loadDashboard();
       loadAnalytics(7);


       if (
           document
               .getElementById(
                   "transactionsSection"
               )
               ?.classList.contains(
                   "active"
               )
       ) {

           loadTransactions();

       }
   }


   /* =========================================================
      SOCKET.IO
      ========================================================= */

   function connectSocket() {

       if (
           typeof io ===
           "undefined"
       ) {

           console.warn(
               "Socket.IO belum tersedia"
           );

           return;

       }


       const socket =
           io(API_URL);


       socket.on(
           "connect",
           () => {

               console.log(
                   "🔌 Socket connected:",
                   socket.id
               );

           }
       );


       socket.on(
           "disconnect",
           () => {

               console.log(
                   "❌ Socket disconnected"
               );

           }
       );


       socket.on(
           "payment:paid",
           payment => {

               console.log(
                   "💰 Payment paid:",
                   payment
               );


               if (
                   currentPayment &&
                   payment.paymentId ===
                       currentPayment.id
               ) {

                   handlePaymentPaid(
                       payment
                   );

               }

               // Perbarui prediksi setelah pembayaran berhasil.
               // Data tetap diambil ulang dari backend.
               if (
                   document.getElementById("predictionSection")
                       ?.classList.contains("active")
               ) {
                   loadPrediction();
               }

           }
       );
   }


   /* =========================================================
      DASHBOARD
      ========================================================= */


function renderDashboardComparison(elementId, percentage, currentValue, previousValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const hasValues =
        currentValue !== null &&
        currentValue !== undefined &&
        previousValue !== null &&
        previousValue !== undefined &&
        Number.isFinite(Number(currentValue)) &&
        Number.isFinite(Number(previousValue));

    if (
        percentage === null ||
        percentage === undefined ||
        !Number.isFinite(Number(percentage))
    ) {
        if (hasValues) {
            const current = Number(currentValue);
            const previous = Number(previousValue);

            const labels = {
                dashboardRevenueChange: {
                    newActivity: "Periode sebelumnya: Rp0",
                    noActivity: "Tidak ada penjualan di kedua periode"
                },
                dashboardTransactionsChange: {
                    newActivity: "Periode sebelumnya: 0 transaksi",
                    noActivity: "Tidak ada transaksi di kedua periode"
                },
                dashboardAverageChange: {
                    newActivity: "Belum ada transaksi pada periode sebelumnya",
                    noActivity: "Belum ada rata-rata transaksi di kedua periode"
                },
                dashboardProfitChange: {
                    newActivity: "Periode sebelumnya: Rp0",
                    noActivity: "Tidak ada keuntungan di kedua periode"
                }
            };

            const label = labels[elementId] || {
                newActivity: "Ada aktivitas baru dibanding periode sebelumnya",
                noActivity: "Tidak ada aktivitas pada kedua periode"
            };

            if (previous === 0 && current > 0) {
                const rupiah = new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0
                }).format(current);

                if (elementId === "dashboardRevenueChange") {
                    element.textContent =
                        `+${rupiah} revenue dibanding periode sebelumnya`;
                } else if (elementId === "dashboardTransactionsChange") {
                    element.textContent =
                        `+${current.toLocaleString("id-ID")} transaksi dibanding periode sebelumnya`;
                } else if (elementId === "dashboardProfitChange") {
                    element.textContent =
                        `+${rupiah} gross profit dibanding periode sebelumnya`;
                } else if (elementId === "dashboardAverageChange") {
                    element.textContent =
                        `+${rupiah} average order dibanding periode sebelumnya`;
                    element.className = "kpi-comparison positive";
                    return;
                } else {
                    element.textContent = label.newActivity;
                }

                element.className = "kpi-comparison positive";
                return;
            }

            if (previous === 0 && current === 0) {
                element.textContent = label.noActivity;
                element.className = "kpi-comparison neutral";
                return;
            }
        }

        element.textContent = "Belum ada data pembanding";
        element.className = "kpi-comparison neutral";
        return;
    }

    const value = Number(percentage);
    const formatted = Math.abs(value).toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    if (value > 0) {
        element.innerHTML =
            `▲ ${formatted}%<br>dibanding periode sebelumnya`;
        element.className = "kpi-comparison positive";
    } else if (value < 0) {
        element.innerHTML =
            `▼ ${formatted}%<br>dibanding periode sebelumnya`;
        element.className = "kpi-comparison negative";
    } else {
        element.innerHTML =
            `0%<br>dibanding periode sebelumnya`;
        element.className = "kpi-comparison neutral";
    }
}

let dashboardSalesChart = null;

function renderDashboardSalesChart(salesByDate = []) {
    const canvas = document.getElementById("dashboardSalesChart");
    if (!canvas || typeof Chart === "undefined") {
        console.warn("Canvas Sales Overview atau Chart.js belum tersedia.");
        return;
    }

    const rows = Array.isArray(salesByDate) ? salesByDate : [];

    const labels = rows.map(item => {
        const rawDate = String(item.date || "");
        const parts = rawDate.split("-");
        return parts.length === 3
            ? `${parts[2]}/${parts[1]}`
            : rawDate;
    });

    const values = rows.map(item => Number(item.revenue) || 0);

    if (dashboardSalesChart) {
        dashboardSalesChart.destroy();
        dashboardSalesChart = null;
    }

    dashboardSalesChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Penjualan",
                data: values,
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: rows.length > 20 ? 1 : 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context =>
                            `Penjualan: ${formatRupiah(context.parsed.y || 0)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value =>
                            "Rp " + Number(value).toLocaleString("id-ID")
                    }
                }
            }
        }
    });
}


/* =========================================================
   DASHBOARD SALES TARGET
   ========================================================= */

function dashboardTargetStorageKey(startDate, endDate) {
    return `smartpos_sales_target_${STORE_ID}_${startDate}_${endDate}`;
}

function formatDashboardTargetCurrency(value) {
    return "Rp " + (Number(value) || 0).toLocaleString("id-ID");
}

function renderDashboardTarget(revenue, startDate, endDate) {
    const input = document.getElementById("dashboardTargetInput");
    const percentEl = document.getElementById("dashboardTargetPercent");
    const bar = document.getElementById("dashboardTargetBar");
    const revenueEl = document.getElementById("dashboardTargetRevenue");
    const remainingEl = document.getElementById("dashboardTargetRemaining");
    const message = document.getElementById("dashboardTargetMessage");
    const saveButton = document.getElementById("saveDashboardTarget");

    if (!input || !percentEl || !bar || !revenueEl || !remainingEl) return;

    const key = dashboardTargetStorageKey(startDate, endDate);
    const savedTarget = Number(localStorage.getItem(key)) || 0;

    input.value = savedTarget || "";
    revenueEl.textContent = formatDashboardTargetCurrency(revenue);

    const hasTarget = savedTarget > 0;
    const percent = hasTarget ? (revenue / savedTarget) * 100 : 0;
    const remaining = hasTarget ? Math.max(savedTarget - revenue, 0) : 0;

    percentEl.textContent = hasTarget
        ? `${percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
        : "—";

    bar.style.width = `${Math.min(percent, 100)}%`;
    bar.style.background = percent >= 100 ? "#16a34a" : "#3b82f6";

    remainingEl.textContent = hasTarget
        ? formatDashboardTargetCurrency(remaining)
        : "Belum ditentukan";

    if (message) {
        message.textContent = !hasTarget
            ? "Masukkan target omzet untuk rentang tanggal ini."
            : percent >= 100
                ? "Target tercapai. Mantap!"
                : `Tercapai ${percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari target.`;
    }

    if (saveButton && saveButton.dataset.bound !== "true") {
        saveButton.dataset.bound = "true";
        saveButton.addEventListener("click", () => {
            const target = Number(input.value);

            if (!Number.isFinite(target) || target <= 0) {
                if (message) message.textContent = "Masukkan target lebih besar dari Rp 0.";
                input.focus();
                return;
            }

            localStorage.setItem(key, String(Math.round(target)));
            renderDashboardTarget(revenue, startDate, endDate);
        });
    }
}

async function loadDashboard(options = {}) {
    const periodSelect = document.getElementById("dashboardPeriod");
    const customDates = document.getElementById("dashboardCustomDates");
    const startInput = document.getElementById("dashboardStartDate");
    const endInput = document.getElementById("dashboardEndDate");

    const period = options.period || periodSelect?.value || "today";

    if (customDates) {
        customDates.classList.toggle("hidden", period !== "custom");
    }

    const toLocalDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    const today = new Date();
    let startDate;
    let endDate;

    if (period === "custom") {
        startDate = options.startDate || startInput?.value;
        endDate = options.endDate || endInput?.value;

        if (!startDate || !endDate) {
            return;
        }

        if (startDate > endDate) {
            alert("Tanggal mulai tidak boleh melewati tanggal akhir.");
            return;
        }
    } else {
        const end = new Date(today);
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);

        if (period === "7") {
            start.setDate(start.getDate() - 6);
        } else if (period === "30") {
            start.setDate(start.getDate() - 29);
        }

        startDate = toLocalDateString(start);
        endDate = toLocalDateString(end);
    }

    const query = new URLSearchParams({
        storeId: STORE_ID,
        startDate,
        endDate
    });

    try {
        const result = await apiFetch(
            `/api/dashboard?${query.toString()}`
        );

        if (!result?.success) {
            throw new Error(
                result?.message || "Gagal memuat dashboard."
            );
        }

        const data = result.data || {};
        const kpi = data.kpi || {};

        const revenue = Number(
            kpi.revenue ?? kpi.revenueToday
        ) || 0;

        const transactions = Number(
            kpi.transactions ?? kpi.transactionsToday
        ) || 0;

        const averageTransaction =
            Number(kpi.averageTransaction) || 0;

        const grossProfit =
            Number(kpi.grossProfit) || 0;

        const revenueElement =
            document.getElementById("dashboardRevenue");

        const transactionsElement =
            document.getElementById("dashboardTransactions");

        const averageElement =
            document.getElementById("dashboardAverage");

        const profitElement =
            document.getElementById("dashboardProfit");

        if (revenueElement) {
            revenueElement.textContent = formatRupiah(revenue);
        }

        if (transactionsElement) {
            transactionsElement.textContent =
                transactions.toLocaleString("id-ID");
        }

        if (averageElement) {
            averageElement.textContent =
                formatRupiah(averageTransaction);
        }

        if (profitElement) {
            profitElement.textContent =
                formatRupiah(grossProfit);
        }


        const comparison = data.comparison || {};

        const previous = comparison.previous || {};

        renderDashboardComparison(
            "dashboardRevenueChange",
            comparison.revenue,
            revenue,
            previous.revenue
        );
        renderDashboardComparison(
            "dashboardTransactionsChange",
            comparison.transactions,
            transactions,
            previous.transactions
        );
        renderDashboardComparison(
            "dashboardAverageChange",
            comparison.averageTransaction,
            averageTransaction,
            previous.averageTransaction
        );
        renderDashboardComparison(
            "dashboardProfitChange",
            comparison.grossProfit,
            grossProfit,
            previous.grossProfit
        );

        renderDashboardSalesChart(data.salesByDate || []);
        renderDashboardTarget(revenue, startDate, endDate);

        // Setiap pergantian periode dimulai dari 10 transaksi.
        const recentTransactionsElement =
            document.getElementById("recentTransactions");

        if (recentTransactionsElement) {
            recentTransactionsElement.dataset.expanded = "false";
        }

        renderDashboardLists(data);

        console.log("📊 Dashboard loaded:", {
            period,
            startDate,
            endDate,
            revenue,
            transactions,
            averageTransaction,
            grossProfit
        });
    } catch (error) {
        console.error("DASHBOARD ERROR:", error);
        alert("Gagal memuat dashboard: " + error.message);
    }
}


/* =========================================================
   DASHBOARD PERIOD FILTER
   ========================================================= */

   function setupDashboardPeriodFilter() {
    const periodSelect = document.getElementById("dashboardPeriod");
    const customDates = document.getElementById("dashboardCustomDates");
    const applyButton = document.getElementById("applyDashboardDates");

    if (!periodSelect || periodSelect.dataset.bound === "true") {
        return;
    }

    periodSelect.dataset.bound = "true";

    // Tampilkan atau sembunyikan pilihan tanggal
    const updateCustomDates = () => {
        const isCustom = periodSelect.value === "custom";

        if (customDates) {
            customDates.classList.toggle("hidden", !isCustom);
        }
    };

    updateCustomDates();

    // Muat dashboard saat periode berubah
    periodSelect.addEventListener("change", () => {
        const period = periodSelect.value;

        updateCustomDates();

        if (period !== "custom") {
            loadDashboard({ period });
        }
    });

    // Terapkan rentang tanggal pilihan
    if (applyButton) {
        applyButton.addEventListener("click", () => {
            loadDashboard({ period: "custom" });
        });
    }
}

   /* =========================================================
      DASHBOARD LISTS
      ========================================================= */

   function renderDashboardLists(data) {

       const bestSeller =
           data.bestSellers ||
           data.bestSeller ||
           data.topProducts ||
           [];


       const paymentMethods =
           data.paymentMethods ||
           [];


       const lowStock =
           data.lowStockProducts ||
           data.lowStock ||
           [];


       const recent =
           data.recentTransactions ||
           [];


       /* =====================================================
          BEST SELLER
          ===================================================== */

       const bestSellerElement =
           document.getElementById(
               "bestSellerList"
           );


       if (bestSellerElement) {

           if (!bestSeller.length) {

               bestSellerElement.innerHTML = `
                   <div class="loading">
                       Belum ada penjualan hari ini.
                   </div>
               `;

           } else {

               bestSellerElement.innerHTML =
                   bestSeller
                       .slice(0, 5)
                       .map(
                           (
                               item,
                               index
                           ) => {

                               const name =
                                   item.name ||
                                   item.productName ||
                                   "-";


                               const quantity =
                                   Number(
                                       item.quantity ||
                                       item.totalQuantity ||
                                       0
                                   );


                               return `
                                   <div class="summary-row">

                                       <span>

                                           <span>
                                               ${index + 1}.
                                           </span>

                                           ${getProductEmoji({
                                               name
                                           })}

                                           ${escapeHtml(
                                               name
                                           )}

                                       </span>

                                       <strong>
                                           ${quantity}
                                       </strong>

                                   </div>
                               `;

                           }
                       )
                       .join("");

           }

       }


       /* =====================================================
          PAYMENT METHODS
          ===================================================== */

       const paymentElement =
           document.getElementById(
               "paymentMethodList"
           );


       if (paymentElement) {

           if (!paymentMethods.length) {

               paymentElement.innerHTML = `
                   <div class="loading">
                       Belum ada pembayaran hari ini.
                   </div>
               `;

           } else {

               paymentElement.innerHTML =
                   paymentMethods
                       .map(
                           item => {

                               const method =
                                   String(
                                       item.method ||
                                       "-"
                                   ).toUpperCase();


                               const count =
                                   Number(
                                       item.transactions ||
                                       item.count ||
                                       item.total ||
                                       0
                                   );


                               let icon = "💳";


                               if (
                                   method ===
                                   "CASH"
                               ) {

                                   icon = "💵";

                               } else if (
                                   method ===
                                   "QRIS"
                               ) {

                                   icon = "📱";

                               }


                               return `
                                   <div class="summary-row">

                                       <span>
                                           ${icon}
                                           ${escapeHtml(
                                               method
                                           )}
                                       </span>

                                       <strong>
                                           ${count}
                                       </strong>

                                   </div>
                               `;

                           }
                       )
                       .join("");

           }

       }


       /* =====================================================
          LOW STOCK
          ===================================================== */

       const lowStockElement =
           document.getElementById(
               "lowStockList"
           );


       if (lowStockElement) {

           if (!lowStock.length) {

               lowStockElement.innerHTML = `
                   <div class="loading">
                       Semua stok aman 👍
                   </div>
               `;

           } else {

               lowStockElement.innerHTML =
                   lowStock
                       .slice(0, 10)
                       .map(
                           item => {

                               const stock =
                                   Number(
                                       item.stock ||
                                       0
                                   );


                               const stockText =
                                   stock <= 0
                                       ? "Habis"
                                       : "Stok rendah";


                               return `
                                   <div class="summary-row">

                                       <span>

                                           ${getProductEmoji({
                                               name:
                                                   item.name ||
                                                   ""
                                           })}

                                           ${escapeHtml(
                                               item.name ||
                                               "-"
                                           )}

                                       </span>

                                       <strong
                                           title="${stockText}"
                                       >
                                           ${stock}
                                       </strong>

                                   </div>
                               `;

                           }
                       )
                       .join("");

           }

       }


/* =====================================================
   RECENT TRANSACTIONS - DASHBOARD
   ===================================================== */

const recentElement = document.getElementById("recentTransactions");

if (recentElement) {
    const recentLimit = 10;

    const renderTransactionRows = (items) => {
        return items.map(item => {
            const orderNumber =
                item.orderNumber || item.order || "-";

            const total = Number(item.total || 0);

            const method = String(
                item.paymentMethod || "-"
            ).toUpperCase();

            let icon = "💳";

            if (method === "CASH") {
                icon = "💵";
            } else if (method === "QRIS") {
                icon = "📱";
            } else if (method === "TRANSFER") {
                icon = "🏦";
            }

            let timeText = "";
            const rawDate = item.paidAt || item.createdAt;

            if (rawDate) {
                const date = new Date(rawDate);

                if (!Number.isNaN(date.getTime())) {
                    timeText = date.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                }
            }

            return `
                <div class="summary-row recent-transaction-row">
                    <span class="recent-transaction-info">
                        <strong class="recent-order-number">${escapeHtml(orderNumber)}</strong>
                        <small class="recent-transaction-time">${timeText}</small>
                    </span>

                    <span class="recent-transaction-payment">
                        <small class="recent-payment-method">
                            ${icon} ${escapeHtml(method)}
                        </small>
                        <strong class="recent-transaction-total">${formatRupiah(total)}</strong>
                    </span>
                </div>
            `;
        }).join("");
    };

    if (!recent.length) {
        recentElement.innerHTML = `
            <div class="loading">
                Belum ada transaksi hari ini.
            </div>
        `;
        recentElement.dataset.expanded = "false";
    } else {
        const expanded =
            recentElement.dataset.expanded === "true";

        const visibleTransactions = expanded
            ? recent
            : recent.slice(0, recentLimit);

        recentElement.innerHTML = `
            <div class="recent-transaction-list">
                ${renderTransactionRows(visibleTransactions)}
            </div>

            ${recent.length > recentLimit ? `
                <button
                    type="button"
                    class="recent-transactions-toggle"
                    aria-expanded="${expanded}"
                >
                    ${expanded
                        ? "Tampilkan lebih sedikit"
                        : `Lihat selengkapnya (${recent.length - recentLimit} lainnya)`
                    }
                </button>
            ` : ""}
        `;

        recentElement.dataset.expanded = String(expanded);

        const toggleButton = recentElement.querySelector(
            ".recent-transactions-toggle"
        );

        if (toggleButton) {
            toggleButton.addEventListener("click", () => {
                const showAll =
                    recentElement.dataset.expanded !== "true";

                recentElement.dataset.expanded = String(showAll);

                const list = recentElement.querySelector(
                    ".recent-transaction-list"
                );

                if (list) {
                    list.innerHTML = renderTransactionRows(
                        showAll
                            ? recent
                            : recent.slice(0, recentLimit)
                    );
                }

                toggleButton.textContent = showAll
                    ? "Tampilkan lebih sedikit"
                    : `Lihat selengkapnya (${recent.length - recentLimit} lainnya)`;

                toggleButton.setAttribute(
                    "aria-expanded",
                    String(showAll)
                );
            });
        }
    }
}
}

   /* =========================================================
      INVENTORY
      ========================================================= */

   async function loadInventory() {

       try {

           const result =
               await apiFetch(
                   `/api/products?storeId=${STORE_ID}`
               );


           inventoryProducts =
               Array.isArray(result.data)
                   ? result.data
                   : [];


           updateInventoryKPI();


           renderInventory();


           console.log(
               "📦 Inventory loaded:",
               inventoryProducts
           );


       } catch (error) {

           console.error(
               "INVENTORY ERROR:",
               error
           );


           const tableBody =
               document.getElementById(
                   "inventoryTableBody"
               );


           if (tableBody) {

               tableBody.innerHTML = `
                   <tr>
                       <td colspan="8">

                           <div class="loading">
                               Gagal mengambil data inventory.
                               <br>
                               ${escapeHtml(
                                   error.message
                               )}
                           </div>

                       </td>
                   </tr>
               `;

           }

       }

   }


   /* =========================================================
      INVENTORY KPI
      ========================================================= */

   function updateInventoryKPI() {

       const totalProducts =
           inventoryProducts.length;


       const totalStock =
           inventoryProducts.reduce(
               (
                   total,
                   product
               ) =>
                   total +
                   Number(
                       product.stock ||
                       0
                   ),
               0
           );


       const lowStock =
           inventoryProducts.filter(
               product => {

                   const stock =
                       Number(
                           product.stock ||
                           0
                       );


                   const minimum =
                       Number(
                           product.minimumStock ??
                           5
                       );


                   return (
                       stock > 0 &&
                       stock <= minimum
                   );

               }
           ).length;


       const outOfStock =
           inventoryProducts.filter(
               product =>
                   Number(
                       product.stock ||
                       0
                   ) <= 0
           ).length;


       const totalElement =
           document.getElementById(
               "inventoryTotalProducts"
           );


       const stockElement =
           document.getElementById(
               "inventoryTotalStock"
           );


       const lowElement =
           document.getElementById(
               "inventoryLowStock"
           );


       const outElement =
           document.getElementById(
               "inventoryOutOfStock"
           );


       if (totalElement) {

           totalElement.textContent =
               totalProducts;

       }


       if (stockElement) {

           stockElement.textContent =
               totalStock;

       }


       if (lowElement) {

           lowElement.textContent =
               lowStock;

       }


       if (outElement) {

           outElement.textContent =
               outOfStock;

       }

   }


   /* =========================================================
      RENDER INVENTORY
      ========================================================= */

   function renderInventory() {

       const tableBody =
           document.getElementById(
               "inventoryTableBody"
           );


       if (!tableBody) return;

       if (inventoryTrashMode) {
           renderDeletedInventory();
           return;
       }

       const searchInput =
           document.getElementById(
               "inventorySearch"
           );


       const search =
           (
               searchInput?.value ||
               ""
           )
               .toLowerCase()
               .trim();


       const filteredProducts =
           inventoryProducts.filter(
               product => {

                   const name =
                       String(
                           product.name ||
                           ""
                       ).toLowerCase();


                   const sku =
                       String(
                           product.sku ||
                           ""
                       ).toLowerCase();


                   const category =
                       String(
                           product.category ||
                           ""
                       ).toLowerCase();


                   const matchesSearch =
                       name.includes(search) ||
                       sku.includes(search) ||
                       category.includes(search);


                   const matchesCategory =
                       inventoryCategory === "ALL" ||
                       String(
                           product.category ||
                           ""
                       ) === inventoryCategory;


                   return (
                       matchesSearch &&
                       matchesCategory
                   );

               }
           );


       if (!filteredProducts.length) {

           tableBody.innerHTML = `
               <tr>

                   <td colspan="8">

                       <div class="inventory-empty">

                           <div class="inventory-empty-icon">
                               📦
                           </div>

                           <strong>
                               Produk tidak ditemukan
                           </strong>

                           <span>
                               Coba ubah kata pencarian
                               atau pilih kategori lain.
                           </span>

                       </div>

                   </td>

               </tr>
           `;

           return;
       }


       tableBody.innerHTML =
           filteredProducts
               .map(
                   product =>
                       renderInventoryRow(
                           product
                       )
               )
               .join("");
   }



   function showConfirmDialog({
       title = "Konfirmasi",
       message = "Apakah kamu yakin?",
       confirmText = "Ya, lanjutkan",
       cancelText = "Batal",
       danger = false
   } = {}) {
       return new Promise(resolve => {
           const overlay = document.createElement("div");
           overlay.className = "smartpos-confirm-overlay";

           const dialog = document.createElement("section");
           dialog.className = "smartpos-confirm-dialog";
           dialog.setAttribute("role", "alertdialog");
           dialog.setAttribute("aria-modal", "true");
           dialog.setAttribute("aria-labelledby", "smartposConfirmTitle");
           dialog.setAttribute("aria-describedby", "smartposConfirmMessage");

           const icon = document.createElement("div");
           icon.className = "smartpos-confirm-icon" + (danger ? " danger" : "");
           icon.textContent = danger ? "!" : "?";

           const heading = document.createElement("h3");
           heading.id = "smartposConfirmTitle";
           heading.textContent = title;

           const description = document.createElement("p");
           description.id = "smartposConfirmMessage";
           description.textContent = message;

           const actions = document.createElement("div");
           actions.className = "smartpos-confirm-actions";

           const cancel = document.createElement("button");
           cancel.type = "button";
           cancel.className = "smartpos-confirm-btn secondary";
           cancel.textContent = cancelText;

           const confirm = document.createElement("button");
           confirm.type = "button";
           confirm.className = "smartpos-confirm-btn " + (danger ? "danger" : "primary");
           confirm.textContent = confirmText;

           actions.append(cancel, confirm);
           dialog.append(icon, heading, description, actions);
           overlay.appendChild(dialog);
           document.body.appendChild(overlay);
           document.body.classList.add("confirm-dialog-open");

           let finished = false;
           function close(result) {
               if (finished) return;
               finished = true;
               document.removeEventListener("keydown", keyHandler);
               document.body.classList.remove("confirm-dialog-open");
               overlay.remove();
               resolve(result);
           }
           function keyHandler(event) {
               if (event.key === "Escape") close(false);
           }

           cancel.addEventListener("click", () => close(false));
           confirm.addEventListener("click", () => close(true));
           overlay.addEventListener("click", event => {
               if (event.target === overlay) close(false);
           });
           document.addEventListener("keydown", keyHandler);
           cancel.focus();
       });
   }

   async function loadDeletedInventory() {
       const result = await apiFetch(
           `/api/products/trash?storeId=${encodeURIComponent(STORE_ID)}`
       );
       deletedInventoryProducts = Array.isArray(result.data)
           ? result.data
           : [];
       renderDeletedInventory();
   }

   function renderDeletedInventory() {
       const body = document.getElementById("inventoryTableBody");
       if (!body) return;

       const search = (
           document.getElementById("inventorySearch")?.value || ""
       ).toLowerCase().trim();

       const rows = deletedInventoryProducts.filter(p =>
           [p.name, p.sku, p.category].some(v =>
               String(v || "").toLowerCase().includes(search)
           )
       );

       if (!rows.length) {
           body.innerHTML = `
             <tr><td colspan="8">
               <div class="inventory-empty">
                 <div class="inventory-empty-icon">🗑️</div>
                 <strong>Tempat sampah kosong</strong>
                 <span>Produk nonaktif akan muncul di sini.</span>
               </div>
             </td></tr>`;
           return;
       }

       body.innerHTML = rows.map(p => `
         <tr class="inventory-product-row">
           <td><strong>${escapeHtml(p.name || "-")}</strong><br>
               <small>ID: ${escapeHtml(p.id || "-")}</small></td>
           <td>
             <div class="inventory-sku-cell">
               <span class="inventory-sku">${escapeHtml(p.sku || "-")}</span>
               <span class="inventory-sku-type">${
                 String(p.category || "").toLowerCase() === "minuman"
                   ? "Drink"
                   : String(p.category || "").toLowerCase() === "makanan"
                     ? "Food"
                     : escapeHtml(p.category || "-")
               }</span>
             </div>
           </td>
           <td>${escapeHtml(p.category || "-")}</td>
           <td>${formatRupiah(p.purchasePrice || 0)}</td>
           <td>${formatRupiah(p.sellingPrice || 0)}</td>
           <td>${Number(p.stock || 0)} unit</td>
           <td><span class="inventory-status empty">Nonaktif</span></td>
           <td class="inventory-trash-actions">
             <button type="button" class="inventory-action-btn edit"
               onclick="restoreDeletedProduct('${escapeHtml(p.id)}')"
               title="Pulihkan produk" aria-label="Pulihkan produk">♻️</button>
             <button type="button" class="inventory-action-btn inventory-permanent-delete"
               onclick="permanentlyDeleteProduct('${escapeHtml(p.id)}')"
               title="Hapus permanen" aria-label="Hapus permanen">🗑️</button>
           </td>
         </tr>`).join("");
   }

   async function restoreDeletedProduct(id) {
       const product = deletedInventoryProducts.find(
           p => String(p.id) === String(id)
       );
       if (!product) return;
       const confirmed = await showConfirmDialog({
           title: "Pulihkan Produk?",
           message: `Produk "${product.name}" akan dikembalikan ke Inventory.`,
           confirmText: "Ya, pulihkan",
           cancelText: "Batal"
       });
       if (!confirmed) return;

       try {
           await apiFetch(`/api/products/${encodeURIComponent(id)}/restore`, {
               method: "PATCH"
           });
           showToast("Produk berhasil dipulihkan", "success");
           await loadDeletedInventory();
           await loadInventory();
           await loadProducts();
           await loadDashboard();
       } catch (error) {
           console.error("RESTORE PRODUCT ERROR:", error);
           showToast(error.message || "Gagal memulihkan produk", "error");
       }
   }


   async function permanentlyDeleteProduct(id) {
       const product = deletedInventoryProducts.find(
           p => String(p.id) === String(id)
       );
       if (!product) return;

       const confirmed = await showConfirmDialog({
           title: "Hapus Permanen?",
           message: `Produk "${product.name}" tidak bisa dipulihkan setelah dihapus. Riwayat transaksi, pembelian, dan pergerakan stok akan dilindungi.`,
           confirmText: "Hapus Permanen",
           cancelText: "Batal",
           danger: true
       });
       if (!confirmed) return;

       try {
           await apiFetch(
               `/api/products/${encodeURIComponent(id)}/permanent`,
               { method: "DELETE" }
           );
           showToast("Produk berhasil dihapus permanen", "success");
           await loadDeletedInventory();
           await loadInventory();
           await loadProducts();
           await loadDashboard();
       } catch (error) {
           console.error("PERMANENT DELETE ERROR:", error);
           showToast(error.message || "Gagal menghapus produk permanen", "error");
       }
   }

   /* =========================================================
      INVENTORY ROW
      ========================================================= */

   function renderInventoryRow(product) {

       const stock =
           Number(
               product.stock || 0
           );


       const minimumStock =
           Number(
               product.minimumStock ?? 5
           );


       let statusClass =
           "available";


       let statusText =
           "Tersedia";


       if (stock <= 0) {

           statusClass =
               "empty";


           statusText =
               "Habis";


       } else if (
           stock <= minimumStock
       ) {

           statusClass =
               "low";


           statusText =
               "Stok Rendah";

       }


       const category =
           product.category || "-";


       const emoji =
           getProductEmoji({
               name:
                   product.name || "",
               category
           });


       const categoryClass =
           String(category)
               .toLowerCase()
               .replace(/\s+/g, "-");


       return `
           <tr class="inventory-product-row">

               <td>

                   <div class="inventory-product-cell">

                       <div class="inventory-product-icon">
                           ${emoji}
                       </div>

                       <div class="inventory-product-info">

                           <strong>
                               ${escapeHtml(
                                   product.name || "-"
                               )}
                           </strong>

                           <small>
                               ID:
                               ${escapeHtml(
                                   product.id || "-"
                               )}
                           </small>

                       </div>

                   </div>

               </td>


               <td>
                   <div class="inventory-sku-cell">
                       <span class="inventory-sku">
                           ${escapeHtml(product.sku || "-")}
                       </span>
                       <span class="inventory-sku-type">
                           ${String(category).toLowerCase() === "minuman"
                               ? "Drink"
                               : String(category).toLowerCase() === "makanan"
                                   ? "Food"
                                   : escapeHtml(category)}
                       </span>
                   </div>
               </td>


               <td>

                   <span
                       class="
                           inventory-category-badge
                           ${categoryClass}
                       "
                   >

                       ${
                           String(category)
                               .toLowerCase() ===
                           "minuman"
                               ? "🥤"
                               : "🍜"
                       }

                       ${escapeHtml(
                           category
                       )}

                   </span>

               </td>


               <td>

                   <span
                       class="
                           inventory-price
                           purchase
                       "
                   >

                       ${formatRupiah(
                           product.purchasePrice || 0
                       )}

                   </span>

               </td>


               <td>

                   <span
                       class="
                           inventory-price
                           selling
                       "
                   >

                       ${formatRupiah(
                           product.sellingPrice || 0
                       )}

                   </span>

               </td>


               <td>

                   <div class="inventory-stock">

                       <strong
                           class="${statusClass}"
                       >
                           ${stock}
                       </strong>

                       <span>
                           unit
                       </span>

                   </div>

               </td>


               <td>

                   <span
                       class="
                           inventory-status
                           ${statusClass}
                       "
                   >

                       <span
                           class="inventory-status-dot"
                       ></span>

                       ${statusText}

                   </span>

               </td>


               <td>

                   <div class="inventory-actions">

                       <button
                           type="button"
                           class="
                               inventory-action-btn
                               edit
                           "
                           onclick="editProduct('${escapeHtml(
                               product.id
                           )}')"
                           title="Edit produk"
                       >
                           ✏️
                       </button>


                       <button
                           type="button"
                           class="
                               inventory-action-btn
                               delete
                           "
                           onclick="deleteProduct('${escapeHtml(
                               product.id
                           )}')"
                           title="Nonaktifkan produk"
                       >
                           🗑️
                       </button>

                   </div>

               </td>

           </tr>
       `;
   }


   /* =========================================================
      OPEN ADD PRODUCT
      ========================================================= */

   function openAddProductModal() {

       editingProductId =
           null;


       const modal =
           document.getElementById(
               "productModal"
           );


       const form =
           document.getElementById(
               "productForm"
           );


       const title =
           document.getElementById(
               "productModalTitle"
           );


       if (form) {

           form.reset();

       }


       const productId =
           document.getElementById(
               "productId"
           );


       const minimumStock =
           document.getElementById(
               "productMinimumStock"
           );


       if (productId) {

           productId.value = "";

       }


       if (minimumStock) {

           minimumStock.value = 5;

       }


       if (title) {

           title.textContent =
               "Tambah Produk";

       }


       modal?.classList.remove(
           "hidden"
       );
   }


   /* =========================================================
      EDIT PRODUCT
      ========================================================= */

   async function editProduct(id) {

       try {

           const result =
               await apiFetch(
                   `/api/products/${id}`
               );


           const product =
               result.data;


           if (!product) {

               throw new Error(
                   "Produk tidak ditemukan"
               );

           }


           editingProductId =
               product.id;


           const fields = {

               productId:
                   product.id,

               productName:
                   product.name || "",

               productSku:
                   product.sku || "",

               productCategory:
                   product.category || "",

               productPurchasePrice:
                   product.purchasePrice || 0,

               productSellingPrice:
                   product.sellingPrice || 0,

               productStock:
                   product.stock || 0,

               productMinimumStock:
                   product.minimumStock ?? 5

           };


           Object.entries(
               fields
           ).forEach(
               (
                   [
                       fieldId,
                       value
                   ]
               ) => {

                   const element =
                       document.getElementById(
                           fieldId
                       );


                   if (element) {

                       element.value =
                           value;

                   }

               }
           );


           const title =
               document.getElementById(
                   "productModalTitle"
               );


           if (title) {

               title.textContent =
                   "Edit Produk";

           }


           document
               .getElementById(
                   "productModal"
               )
               ?.classList.remove(
                   "hidden"
               );


       } catch (error) {

           console.error(
               "EDIT PRODUCT ERROR:",
               error
           );


           showToast(
               error.message,
               "error"
           );

       }
   }


   /* =========================================================
      SAVE PRODUCT
      ========================================================= */

   async function saveProduct(event) {

       event.preventDefault();


       const saveButton =
           document.getElementById(
               "saveProductBtn"
           );


       const productIdElement =
           document.getElementById(
               "productId"
           );


       const productNameElement =
           document.getElementById(
               "productName"
           );


       const productSkuElement =
           document.getElementById(
               "productSku"
           );


       const productCategoryElement =
           document.getElementById(
               "productCategory"
           );


       const purchaseElement =
           document.getElementById(
               "productPurchasePrice"
           );


       const sellingElement =
           document.getElementById(
               "productSellingPrice"
           );


       const stockElement =
           document.getElementById(
               "productStock"
           );


       const minimumElement =
           document.getElementById(
               "productMinimumStock"
           );


       if (
           !productIdElement ||
           !productNameElement ||
           !productSkuElement ||
           !productCategoryElement ||
           !purchaseElement ||
           !sellingElement ||
           !stockElement ||
           !minimumElement
       ) {

           showToast(
               "Form produk tidak lengkap",
               "error"
           );

           return;
       }


       const productId =
           productIdElement.value;


       const productData = {

           storeId:
               STORE_ID,

           name:
               productNameElement.value.trim(),

           sku:
               productSkuElement.value.trim(),

           category:
               productCategoryElement.value,

           purchasePrice:
               Number(
                   purchaseElement.value
               ),

           sellingPrice:
               Number(
                   sellingElement.value
               ),

           stock:
               Number(
                   stockElement.value
               ),

           minimumStock:
               Number(
                   minimumElement.value
               )

       };


       if (
           !productData.name ||
           !productData.sku ||
           !productData.category
       ) {

           showToast(
               "Data produk belum lengkap",
               "error"
           );

           return;
       }


       if (
           productData.purchasePrice < 0 ||
           productData.sellingPrice < 0 ||
           productData.stock < 0 ||
           productData.minimumStock < 0
       ) {

           showToast(
               "Nilai produk tidak boleh negatif",
               "error"
           );

           return;
       }


       try {

           if (saveButton) {

               saveButton.disabled =
                   true;


               saveButton.textContent =
                   productId
                       ? "Menyimpan..."
                       : "Menambahkan...";

           }


           if (productId) {

               await apiFetch(
                   `/api/products/${productId}`,
                   {
                       method: "PUT",

                       body:
                           JSON.stringify(
                               productData
                           )
                   }
               );


               showToast(
                   "Produk berhasil diperbarui",
                   "success"
               );


           } else {

               await apiFetch(
                   "/api/products",
                   {
                       method: "POST",

                       body:
                           JSON.stringify(
                               productData
                           )
                   }
               );


               showToast(
                   "Produk berhasil ditambahkan",
                   "success"
               );

           }


           closeProductModal();


           await loadInventory();
           await loadProducts();
           await loadDashboard();


       } catch (error) {

           console.error(
               "SAVE PRODUCT ERROR:",
               error
           );


           showToast(
               error.message,
               "error"
           );


       } finally {

           if (saveButton) {

               saveButton.disabled =
                   false;


               saveButton.textContent =
                   "Simpan Produk";

           }

       }
   }


   /* =========================================================
      DELETE PRODUCT
      ========================================================= */

   async function deleteProduct(id) {

       const product =
           inventoryProducts.find(
               item =>
                   String(item.id) ===
                   String(id)
           );


       if (!product) return;


       const confirmed =
           confirm(
               `Nonaktifkan produk "${product.name}"?`
           );


       if (!confirmed) return;


       try {

           await apiFetch(
               `/api/products/${id}`,
               {
                   method: "DELETE"
               }
           );


           showToast(
               "Produk berhasil dinonaktifkan",
               "success"
           );


           await loadInventory();
           await loadProducts();
           await loadDashboard();


       } catch (error) {

           console.error(
               "DELETE PRODUCT ERROR:",
               error
           );


           showToast(
               error.message,
               "error"
           );

       }
   }


   /* =========================================================
      CLOSE PRODUCT MODAL
      ========================================================= */

   function closeProductModal() {

       document
           .getElementById(
               "productModal"
           )
           ?.classList.add(
               "hidden"
           );

   }


   /* =========================================================
      INVENTORY EVENTS
      ========================================================= */

   function setupInventoryEvents() {

       const addButton =
           document.getElementById(
               "addProductBtn"
           );


       addButton?.addEventListener(
           "click",
           openAddProductModal
       );

       const trashButton = document.getElementById("inventoryTrashBtn");
       trashButton?.addEventListener("click", async () => {
           inventoryTrashMode = !inventoryTrashMode;

           document.getElementById("inventorySection")
               ?.classList.toggle("inventory-trash-mode", inventoryTrashMode);

           trashButton.textContent = inventoryTrashMode
               ? "← Kembali ke Inventory"
               : "🗑️ Tempat Sampah";

           const h2 = document.querySelector(".inventory-heading h2");
           const desc = document.querySelector(".inventory-heading p");
           if (h2) h2.textContent = inventoryTrashMode
               ? "Tempat Sampah" : "Inventory";
           if (desc) desc.textContent = inventoryTrashMode
               ? "Pulihkan produk yang dinonaktifkan."
               : "Kelola produk dan stok toko.";

           document.querySelectorAll(".inventory-category-btn").forEach(btn => {
               btn.disabled = inventoryTrashMode;
           });

           try {
               if (inventoryTrashMode) await loadDeletedInventory();
               else renderInventory();
           } catch (error) {
               console.error("LOAD TRASH ERROR:", error);
               showToast(error.message || "Gagal memuat tempat sampah", "error");
           }
       });


       const closeButton =
           document.getElementById(
               "closeProductModal"
           );


       closeButton?.addEventListener(
           "click",
           closeProductModal
       );


       const cancelButton =
           document.getElementById(
               "cancelProductBtn"
           );


       cancelButton?.addEventListener(
           "click",
           closeProductModal
       );


       const form =
           document.getElementById(
               "productForm"
           );


       form?.addEventListener(
           "submit",
           saveProduct
       );


       const search =
           document.getElementById(
               "inventorySearch"
           );


       search?.addEventListener(
           "input",
           renderInventory
       );


       document
           .querySelectorAll(
               ".inventory-category-btn"
           )
           .forEach(
               button => {

                   button.addEventListener(
                       "click",
                       () => {

                           document
                               .querySelectorAll(
                                   ".inventory-category-btn"
                               )
                               .forEach(
                                   btn =>
                                       btn.classList.remove(
                                           "active"
                                       )
                               );


                           button.classList.add(
                               "active"
                           );


                           inventoryCategory =
                               button.dataset
                                   .inventoryCategory ||
                               "ALL";


                           renderInventory();

                       }
                   );

               }
           );

   }


/* =========================================================
   ANALYTICS
========================================================= */

async function loadAnalytics(days = 7, startDate = null, endDate = null) {
    try {
        const params = new URLSearchParams({
            storeId: STORE_ID
        });

        // Jika tanggal khusus dipilih, kirim rentang tanggal.
        if (startDate && endDate) {
            params.set("startDate", startDate);
            params.set("endDate", endDate);
        } else {
            params.set("days", String(days));
        }

        const result = await apiFetch(
            `/api/analytics?${params.toString()}`
        );

        const data = result?.data || {};
        const summary = data.summary || data;

        const elements = {
            analyticsRevenue: formatRupiah(summary.revenue || 0),
            analyticsTransactions: Number(summary.transactions) || 0,
            analyticsAverage: formatRupiah(summary.averageTransaction || 0),
            analyticsProfit: formatRupiah(summary.grossProfit || 0),
            analyticsExpenses: formatRupiah(summary.expenses || 0),
            analyticsNetProfit: formatRupiah(summary.netProfit || 0),
            analyticsMargin: `${Number(
                summary.profitMargin ?? summary.margin ?? 0
            ).toFixed(1)}%`
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Simpan data agar semua grafik dan daftar menggunakan data terbaru.
        window.smartposAnalyticsData = data;

        renderAnalyticsCharts(data);
        renderAnalyticsLists(data);

        console.log("📈 Analytics loaded:", {
            days,
            startDate,
            endDate,
            data
        });

    } catch (error) {
        console.error("ANALYTICS ERROR:", error);
    }
}


/* =========================================================
   ANALYTICS - DATE FILTER EVENTS
========================================================= */


function reportsLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function reportsEscapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    }[char]));
}

function reportsFormatDate(value) {
    if (!value) return "-";
    const parts = String(value).slice(0, 10).split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function reportsSetMessage(message, isError = false) {
    const element = document.getElementById("reportsMessage");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-error", Boolean(isError));
}

function reportsSetMoney(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = formatRupiah(Number(value) || 0);
}


function reportsDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function reportsGetPeriodRange(period, base = new Date()) {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    let start;
    let end;

    if (period === "week") {
        const weekday = (date.getDay() + 6) % 7;
        start = new Date(date);
        start.setDate(date.getDate() - weekday);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else if (period === "month") {
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    } else if (period === "year") {
        start = new Date(date.getFullYear(), 0, 1);
        end = new Date(date.getFullYear(), 11, 31);
    } else {
        start = new Date(date);
        end = new Date(date);
    }

    return {
        startDate: reportsDateInputValue(start),
        endDate: reportsDateInputValue(end)
    };
}

function reportsGetPreviousRange(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const days = Math.round((end - start) / 86400000) + 1;
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - days + 1);

    return {
        startDate: reportsDateInputValue(previousStart),
        endDate: reportsDateInputValue(previousEnd)
    };
}

function reportsMoneyValue(value) {
    return formatRupiah(Number(value) || 0);
}


let reportsGroupingMode = "day";

function reportsGroupDailySales(dailySales, mode) {
    const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const groups = new Map();

    for (const day of dailySales) {
        const parts = String(day.date).split("-").map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) continue;

        const [year, month, date] = parts;
        const monthName = monthNames[month - 1];
        let key;
        let label;

        if (mode === "week") {
            const week = Math.floor((date - 1) / 7) + 1;
            key = `${year}-${String(month).padStart(2, "0")}-W${week}`;
            label = `Minggu ${week} ${monthName} ${year}`;
        } else if (mode === "month") {
            key = `${year}-${String(month).padStart(2, "0")}`;
            label = `${monthName} ${year}`;
        } else if (mode === "year") {
            key = String(year);
            label = String(year);
        } else {
            key = String(day.date);
            label = reportsFormatDate(day.date);
        }

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                period: label,
                transactions: 0,
                revenue: 0,
                expenses: 0
            });
        }

        const group = groups.get(key);
        group.transactions += Number(day.transactions) || 0;
        group.revenue += Number(day.revenue) || 0;
        group.expenses += Number(day.expenses) || 0;
    }

    return Array.from(groups.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(group => ({
            ...group,
            afterExpenses: group.revenue - group.expenses
        }));
}

function reportsRenderSummaryRows(summary) {
    const revenue = Number(summary.revenue) || 0;
    const expenses = Number(summary.expenses) || 0;

    return `
        <tr class="reports-summary-row">
            <td colspan="4"><strong>Total</strong></td>
            <td class="reports-summary-amount"><strong>${reportsEscapeHtml(reportsMoneyValue(revenue))}</strong></td>
        </tr>
        <tr class="reports-summary-row">
            <td colspan="4"><strong>Pengeluaran</strong></td>
            <td class="reports-summary-amount"><strong>${reportsEscapeHtml(reportsMoneyValue(expenses))}</strong></td>
        </tr>
        <tr class="reports-summary-row reports-summary-final">
            <td colspan="4"><strong>Total setelah pengeluaran</strong></td>
            <td class="reports-summary-amount"><strong>${reportsEscapeHtml(reportsMoneyValue(revenue - expenses))}</strong></td>
        </tr>`;
}


async function loadReports() {
    const startInput = document.getElementById("reportsStartDate");
    const endInput = document.getElementById("reportsEndDate");
    const body = document.getElementById("reportsTransactionsBody");
    const head = document.getElementById("reportsTableHeadRow");

    if (!startInput || !endInput || !body) return;

    const today = reportsGetPeriodRange("day", new Date());
    if (!startInput.value) startInput.value = today.startDate;
    if (!endInput.value) endInput.value = today.endDate;

    const startDate = startInput.value;
    const endDate = endInput.value;

    if (startDate > endDate) {
        reportsSetMessage("Tanggal awal tidak boleh melewati tanggal akhir.", true);
        return;
    }

    const applyButton = document.getElementById("reportsApplyButton");
    const comparisonElement = document.getElementById("reportsComparison");

    if (applyButton) applyButton.disabled = true;
    reportsSetMessage("Memuat rekap...");
    body.innerHTML = '<tr><td colspan="5" class="reports-empty">Memuat data...</td></tr>';

    try {
        const params = new URLSearchParams({ storeId: STORE_ID, startDate, endDate, groupingMode: reportsGroupingMode });
        const result = await apiFetch(`/api/reports?${params.toString()}`);
        const report = result.data || result.report || result;
        const summary = report.summary || {};
        const dailySales = Array.isArray(report.dailySales) ? report.dailySales : [];
        const groups = reportsGroupDailySales(dailySales, reportsGroupingMode);

        if (head) {
            head.innerHTML = `
                <th>Periode</th>
                <th>Jumlah Transaksi</th>
                <th>Total Penjualan</th>
                <th>Pengeluaran</th>
                <th>Total setelah pengeluaran</th>`;
        }

        const groupRows = groups.map(group => `
            <tr>
                <td>${reportsEscapeHtml(group.period)}</td>
                <td>${group.transactions.toLocaleString("id-ID")}</td>
                <td>${reportsEscapeHtml(reportsMoneyValue(group.revenue))}</td>
                <td>${reportsEscapeHtml(reportsMoneyValue(group.expenses))}</td>
                <td>${reportsEscapeHtml(reportsMoneyValue(group.afterExpenses))}</td>
            </tr>
        `).join("");

        const emptyRow = '<tr><td colspan="5" class="reports-empty">Tidak ada data pada rentang tanggal ini.</td></tr>';
        body.innerHTML = (groupRows || emptyRow) + reportsRenderSummaryRows(summary);

        const countElement = document.getElementById("reportsTransactionCount");
        if (countElement) {
            countElement.textContent = `${(Number(summary.transactions) || 0).toLocaleString("id-ID")} transaksi`;
        }

        const previous = reportsGetPreviousRange(startDate, endDate);

        try {
            const previousParams = new URLSearchParams({
                storeId: STORE_ID,
                startDate: previous.startDate,
                endDate: previous.endDate
            });
            const previousResult = await apiFetch(`/api/reports?${previousParams.toString()}`);
            const previousReport = previousResult.data || previousResult.report || previousResult;
            const previousSummary = previousReport.summary || {};

            const currentRevenue = Number(summary.revenue) || 0;
            const previousRevenue = Number(previousSummary.revenue) || 0;
            const difference = currentRevenue - previousRevenue;
            const direction = difference > 0 ? "naik" : difference < 0 ? "turun" : "tetap";

            if (comparisonElement) {
                comparisonElement.textContent =
                    `Periode sebelumnya (${reportsFormatDate(previous.startDate)}–${reportsFormatDate(previous.endDate)}): ` +
                    `Total ${reportsMoneyValue(previousRevenue)} · ` +
                    `Pengeluaran ${reportsMoneyValue(previousSummary.expenses)} · ` +
                    `Pemasukan periode ini ${direction} ${reportsMoneyValue(Math.abs(difference))}.`;
            }
        } catch (comparisonError) {
            console.warn("Perbandingan periode sebelumnya tidak tersedia:", comparisonError);
            if (comparisonElement) {
                comparisonElement.textContent = "Perbandingan periode sebelumnya tidak tersedia.";
            }
        }

        reportsSetMessage(`Rekap ${reportsFormatDate(startDate)}–${reportsFormatDate(endDate)} berhasil dimuat.`);
    } catch (error) {
        console.error("Gagal memuat rekap:", error);
        body.innerHTML = '<tr><td colspan="5" class="reports-empty">Data rekap gagal dimuat.</td></tr>';
        reportsSetMessage(`Gagal memuat rekap: ${error.message}`, true);
    } finally {
        if (applyButton) applyButton.disabled = false;
    }
}

function setupReportsEvents() {
    const applyButton = document.getElementById("reportsApplyButton");
    const exportButton = document.getElementById("reportsExportButton");
    const periodButtons = document.querySelectorAll("[data-reports-period]");

    periodButtons.forEach(button => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";
        button.addEventListener("click", () => {
            reportsGroupingMode = button.dataset.reportsPeriod || "day";
            periodButtons.forEach(item => item.classList.toggle("is-active", item === button));
            loadReports();
        });
    });

    if (applyButton && !applyButton.dataset.bound) {
        applyButton.dataset.bound = "true";
        applyButton.addEventListener("click", loadReports);
    }

    if (exportButton && !exportButton.dataset.bound) {
        exportButton.dataset.bound = "true";
        exportButton.addEventListener("click", async () => {
            const startDate = document.getElementById("reportsStartDate")?.value;
            const endDate = document.getElementById("reportsEndDate")?.value;

            if (!startDate || !endDate || startDate > endDate) {
                reportsSetMessage("Periksa rentang tanggal sebelum mengekspor.", true);
                return;
            }

            const params = new URLSearchParams({ storeId: STORE_ID, startDate, endDate, groupingMode: reportsGroupingMode });
            exportButton.disabled = true;
            reportsSetMessage("Menyiapkan file Excel...");

            try {
                const exportToken = localStorage.getItem("smartpos_token");
                const headers = {};
                if (exportToken) headers.Authorization = `Bearer ${exportToken}`;

                const response = await fetch(`${API_URL}/api/reports/export?${params.toString()}`, { headers });

                if (response.status === 401) {
                    localStorage.removeItem("smartpos_token");
                    localStorage.removeItem("smartpos_user");
                    throw new Error("Sesi berakhir. Silakan login kembali.");
                }
                if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `Rekap_${reportsGroupingMode}_${startDate}_${endDate}.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                reportsSetMessage("File Excel berhasil disiapkan.");
            } catch (error) {
                console.error("Gagal mengekspor rekap:", error);
                reportsSetMessage(`Ekspor gagal: ${error.message}`, true);
            } finally {
                exportButton.disabled = false;
            }
        });
    }
}




async function loadPrediction() {
    const notice = document.getElementById("predictionNotice");
    const rows = document.getElementById("predictionRows");
    const button = document.getElementById("refreshPredictionButton");

    if (notice) notice.textContent = "Mengambil riwayat penjualan 90 hari...";
    if (rows) rows.innerHTML = '<tr><td colspan="3">Memuat data...</td></tr>';
    if (button) button.disabled = true;

    try {
        const params = new URLSearchParams({
            storeId: STORE_ID,
            days: "90"
        });

        const result = await apiFetch(`/api/analytics?${params.toString()}`);
        const data = result?.data || {};
        const dailySales = Array.isArray(data.dailySales) ? data.dailySales : [];

        const revenues = dailySales
            .map(day => Number(day?.revenue))
            .filter(value => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b);

        const totalRevenue = revenues.reduce((sum, value) => sum + value, 0);
        let median = null;

        if (revenues.length) {
            const middle = Math.floor(revenues.length / 2);
            median = revenues.length % 2
                ? revenues[middle]
                : (revenues[middle - 1] + revenues[middle]) / 2;
        }

        document.getElementById("predictionMedianRevenue").textContent =
            median === null ? "Belum tersedia" : formatRupiah(median);

        document.getElementById("predictionActiveDays").textContent =
            `${revenues.length} hari`;

        document.getElementById("predictionHistoryRevenue").textContent =
            formatRupiah(totalRevenue);

        if (rows) {
            rows.innerHTML = median === null
                ? '<tr><td colspan="3">Belum ada penjualan tercatat.</td></tr>'
                : Array.from({ length: 7 }, (_, index) => `
                    <tr>
                      <td>Hari operasional ke-${index + 1}</td>
                      <td>${formatRupiah(median)}</td>
                      <td>Median historis</td>
                    </tr>
                  `).join("");
        }

        if (notice) {
            notice.classList.toggle("prediction-notice-warning", revenues.length < 30);
            notice.textContent = revenues.length < 30
                ? `Data masih terbatas: ${revenues.length} hari memiliki transaksi dari ${dailySales.length} hari kalender. Estimasi ini hanya baseline awal dan belum tervalidasi.`
                : `Median dihitung dari ${revenues.length} hari dengan penjualan tercatat. Akurasi tetap perlu diuji menggunakan data historis.`;
        }

        console.log("Prediction loaded:", {
            historyCalendarDays: dailySales.length,
            daysWithSales: revenues.length,
            medianRevenue: median
        });
    } catch (error) {
        console.error("PREDICTION ERROR:", error);

        if (notice) {
            notice.classList.add("prediction-notice-warning");
            notice.textContent =
                "Data gagal dimuat. Periksa koneksi server dan akses akun.";
        }

        if (rows) {
            rows.innerHTML = '<tr><td colspan="3">Data belum dapat dimuat.</td></tr>';
        }
    } finally {
        if (button) button.disabled = false;
    }
}

function setupAnalyticsDateFilters() {
    const startInput = document.getElementById("analyticsStartDate");
    const endInput = document.getElementById("analyticsEndDate");
    const applyButton = document.getElementById("applyAnalyticsDateRange");
    const resetButton = document.getElementById("resetAnalyticsDateRange");

    const periodButtons = document.querySelectorAll(
        ".analytics-controls .period-btn"
    );

    if (!startInput || !endInput || !applyButton || !resetButton) {
        console.warn("Analytics date filter: elemen HTML belum lengkap.");
        return;
    }

    // Hindari memasang event listener berulang.
    if (applyButton.dataset.bound === "true") return;
    applyButton.dataset.bound = "true";

    function setActivePeriod(activeButton) {
        periodButtons.forEach(button => {
            button.classList.toggle("active", button === activeButton);
        });
    }

    // Filter 7, 30, dan 90 hari.
    periodButtons.forEach(button => {
        button.addEventListener("click", () => {
            const days = Number(button.dataset.days) || 7;

            startInput.value = "";
            endInput.value = "";

            setActivePeriod(button);
            loadAnalytics(days);
        });
    });

    // Terapkan rentang tanggal khusus.
    applyButton.addEventListener("click", () => {
        const startDate = startInput.value;
        const endDate = endInput.value;

        if (!startDate || !endDate) {
            alert("Pilih tanggal mulai dan tanggal akhir terlebih dahulu.");
            return;
        }

        if (startDate > endDate) {
            alert("Tanggal mulai tidak boleh melebihi tanggal akhir.");
            return;
        }

        setActivePeriod(null);
        loadAnalytics(7, startDate, endDate);
    });

    // Reset ke periode 7 hari.
    resetButton.addEventListener("click", () => {
        startInput.value = "";
        endInput.value = "";

        const sevenDayButton = [...periodButtons].find(
            button => Number(button.dataset.days) === 7
        );

        setActivePeriod(sevenDayButton || null);
        loadAnalytics(7);
    });
}


   /* ==========================================
   SMARTPOS ANALYTICS PRO - CHART ENGINE
   ========================================== */

window.smartposAnalyticsCharts =
window.smartposAnalyticsCharts || {};

function renderSmartPOSChart(
canvasId,
chartType,
labels,
datasets,
options = {}
) {
const canvas = document.getElementById(canvasId);
if (!canvas || typeof Chart === "undefined") return;

const charts = window.smartposAnalyticsCharts;

if (charts[canvasId]) {
    charts[canvasId].destroy();
    delete charts[canvasId];
}

if (!Array.isArray(labels) || labels.length === 0) return;

const isDoughnut = chartType === "doughnut";
const actualType = chartType === "area" ? "line" : chartType;

let chartLabels = labels;
let chartDatasets = datasets.map((dataset, index) => ({
    ...dataset,
    borderWidth: chartType === "bar" ? 0 : 2.5,
    tension: 0.38,
    borderCapStyle: "round",
    borderJoinStyle: "round",
    borderRadius: chartType === "bar" ? 7 : 0,
    borderSkipped: false,
    pointRadius: isDoughnut || chartType === "bar" ? 0 : 3,
    pointHoverRadius: isDoughnut || chartType === "bar" ? 0 : 6,
    pointHitRadius: 12,
    pointBackgroundColor: dataset.borderColor ||
        ["#15966a", "#e59a42", "#7772df"][index % 3],
    pointBorderColor: "#ffffff",
    pointBorderWidth: 2,
    borderColor: dataset.borderColor ||
        ["#15966a", "#e59a42", "#7772df"][index % 3],
    backgroundColor: chartType === "bar"
        ? (index === 0 ? "#15966a" : ["#15966a", "#FBBF24", "#60A5FA"][index % 3])
        : (dataset.backgroundColor ||
            ["rgba(21,150,106,0.16)",
             "rgba(229,154,66,0.16)",
             "rgba(119,114,223,0.16)"][index % 3]),
    hoverBackgroundColor: chartType === "bar"
        ? (index === 0 ? "#117a56" : ["#117a56", "#F59E0B", "#3B82F6"][index % 3])
        : dataset.hoverBackgroundColor,
    fill: chartType === "area"
}));

if (isDoughnut) {
    chartLabels = options.doughnutLabels || labels;

    chartDatasets = [{
        label: options.doughnutLabel || "Komposisi",
        data: options.doughnutValues ||
            (datasets[0]?.data || []),
        backgroundColor: [
            "#16a085", "#e67e22", "#6366f1",
            "#ec4899", "#f59e0b", "#06b6d4",
            "#84cc16", "#8b5cf6", "#64748b",
            "#ef4444"
        ],
        borderWidth: 3,
        borderColor: "#ffffff",
        hoverOffset: 7,
        spacing: 3,
        borderRadius: 4
    }];
}

charts[canvasId] = new Chart(canvas, {
    type: actualType,
    data: {
        labels: chartLabels,
        datasets: chartDatasets
    },

    plugins: isDoughnut ? [{
        id: "smartposDoughnutPercentLabels",

        afterDatasetsDraw(chart) {
            const dataset = chart.data.datasets[0];
            if (!dataset) return;

            const values = dataset.data.map(value =>
                Math.max(0, Number(value) || 0)
            );

            const total = values.reduce(
                (sum, value) => sum + value,
                0
            );

            if (total <= 0) return;

            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);

            ctx.save();
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            meta.data.forEach((arc, index) => {
                const value = values[index];
                if (value <= 0) return;

                const percentage = (value / total) * 100;

                const props = arc.getProps([
                    "x",
                    "y",
                    "startAngle",
                    "endAngle",
                    "innerRadius",
                    "outerRadius"
                ], true);

                const angle =
                    (props.startAngle + props.endAngle) / 2;

                const radius =
                    (props.innerRadius + props.outerRadius) / 2;

                const x = props.x + Math.cos(angle) * radius;
                const y = props.y + Math.sin(angle) * radius;

                const label =
                    percentage.toLocaleString("id-ID", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1
                    }) + "%";

                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
                ctx.strokeText(label, x, y);

                ctx.fillStyle = "#ffffff";
                ctx.fillText(label, x, y);
            });

            ctx.restore();
        }
    }] : [],

    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: "top",
                labels: {
                    usePointStyle: true,
                    pointStyle: "circle",
                    boxWidth: 8,
                    boxHeight: 8,
                    padding: 16,
                    color: "#64736a",
                    font: {
                        size: 11,
                        family: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label(context) {
                        const value = Number(context.parsed?.y ??
                            context.parsed ?? 0);

                        const label = context.dataset?.label ||
                            context.label || "";

                        const formatted = options.currency
                            ? formatRupiah(value)
                            : value.toLocaleString("id-ID");

                        return `${label}: ${formatted}`;
                    }
                }
            }
        },
        scales: isDoughnut ? {} : {
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                border: { display: false },
                ticks: {
                    color: "#849188",
                    font: { size: 10 },
                    maxRotation: 0,
                    autoSkip: true
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: "rgba(112, 132, 119, 0.12)",
                    drawBorder: false,
                    lineWidth: 1
                },
                border: { display: false },
                ticks: {
                    color: "#849188",
                    padding: 9,
                    font: { size: 10 },
                    callback(value) {
                        return options.currency
                            ? formatRupiah(value)
                            : value;
                    }
                }
            }
        }
    }
});
}

function getAnalyticsChartType(selectId) {
return document.getElementById(selectId)?.value || "line";
}

function renderAnalyticsCharts(data = {}) {
const daily = data.dailySales || data.salesByDay || [];
const summary = data.summary || data;

const labels = daily.map(item => item.date || item.day || "");
const revenues = daily.map(item =>
    Number(item.revenue ?? item.sales ?? item.total ?? 0)
);
const expenses = daily.map(item =>
    Number(item.expenses ?? item.expense ?? 0)
);
const grossProfits = daily.map(item =>
    Number(item.profit ?? 0)
);
const netProfits = daily.map(item =>
    Number(item.netProfit ?? 0)
);
const transactions = daily.map(item =>
    Number(item.transactions ?? item.transactionCount ?? 0)
);

// 1. Revenue & Pengeluaran
renderSmartPOSChart(
    "revenueChart",
    getAnalyticsChartType("revenueChartType"),
    labels,
    [
        { label: "Revenue", data: revenues },
        { label: "Pengeluaran", data: expenses }
    ],
    {
        currency: true,
        doughnutLabels: ["Revenue", "Pengeluaran"],
        doughnutValues: [
            Number(summary.revenue ?? 0),
            Number(summary.expenses ?? 0)
        ]
    }
);

// 2. Laba Kotor & Laba Bersih
renderSmartPOSChart(
    "profitChart",
    getAnalyticsChartType("profitChartType"),
    labels,
    [
        { label: "Laba Kotor", data: grossProfits },
        { label: "Laba Bersih", data: netProfits }
    ],
    {
        currency: true,
        doughnutLabels: ["Laba Kotor", "Laba Bersih"],
        doughnutValues: [
            Number(summary.grossProfit ?? summary.profit ?? 0),
            Number(summary.netProfit ?? 0)
        ]
    }
);

/* 3. TREN TRANSAKSI / CASH VS QRIS */

const paymentMethods = data.paymentMethods || [];

const cashPayment = paymentMethods.find(
    item => String(item.method).toUpperCase() === "CASH"
);

const qrisPayment = paymentMethods.find(
    item => String(item.method).toUpperCase() === "QRIS"
);

const cashTransactions = Number(cashPayment?.transactions ?? 0);
const qrisTransactions = Number(qrisPayment?.transactions ?? 0);

renderSmartPOSChart(
    "transactionsChart",
    getAnalyticsChartType("transactionsChartType"),
    labels,
    [{ label: "Transaksi Harian", data: transactions }],
    {
        doughnutLabels: ["CASH", "QRIS"],
        doughnutValues: [cashTransactions, qrisTransactions],
        doughnutLabel: "Jumlah Transaksi"
    }
);

// 4. Produk Terlaris
const topProducts = data.topProducts || [];
const productLabels = topProducts.map(item => item.name || "Produk");
const productQuantities = topProducts.map(item =>
    Number(item.quantity ?? 0)
);

renderSmartPOSChart(
    "topProductsChart",
    getAnalyticsChartType("topProductsChartType"),
    productLabels,
    [{ label: "Jumlah Terjual", data: productQuantities }]
);

// 5. Jam Ramai — menunggu data asli dari backend
const busyHours = data.busyHours || [];

renderSmartPOSChart(
    "busyHoursChart",
    getAnalyticsChartType("busyHoursChartType"),
    busyHours.map(item => item.hourLabel || item.hour || ""),
    [{
        label: "Jumlah Transaksi",
        data: busyHours.map(item =>
            Number(item.transactions ?? 0)
        )
    }]
);

// 6. Perbandingan Penjualan — menunggu data backend
const comparison = data.comparison;

if (comparison) {
    const comparisonLabels = [
        comparison.currentLabel || "Periode Ini",
        comparison.previousLabel || "Periode Sebelumnya"
    ];

    const comparisonValues = [
        Number(comparison.currentRevenue ?? 0),
        Number(comparison.previousRevenue ?? 0)
    ];

    renderSmartPOSChart(
        "comparisonChart",
        getAnalyticsChartType("comparisonChartType"),
        comparisonLabels,
        [{ label: "Revenue", data: comparisonValues }],
        {
            currency: true,
            doughnutLabels: comparisonLabels,
            doughnutValues: comparisonValues
        }
    );
}

// 7. Produk Paling Menguntungkan
const profitableProducts = [...topProducts]
    .sort((a, b) => Number(b.profit ?? 0) - Number(a.profit ?? 0))
    .slice(0, 10);

const profitLabels = profitableProducts.map(item =>
    item.name || "Produk"
);
const productProfits = profitableProducts.map(item =>
    Number(item.profit ?? 0)
);

renderSmartPOSChart(
    "profitableProductsChart",
    getAnalyticsChartType("profitableProductsChartType"),
    profitLabels,
    [{ label: "Laba Produk", data: productProfits }],
    {
        currency: true,
        doughnutLabels: profitLabels,
        doughnutValues: productProfits
    }
);
}

   /* =========================================================
      ANALYTICS LISTS
      ========================================================= */

   function renderAnalyticsLists(data) {

       const topProducts =
           data.topProducts ||
           [];


       const paymentMethods =
           data.paymentMethods ||
           [];


       const topElement =
           document.getElementById(
               "analyticsTopProducts"
           );


       if (topElement) {

           if (!topProducts.length) {

               topElement.innerHTML = `
                   <div class="loading">
                       Belum ada data.
                   </div>
               `;

           } else {

               topElement.innerHTML =
                   topProducts
                       .slice(0, 6)
                       .map(
                           item => {

                               const name =
                                   item.name ||
                                   item.productName ||
                                   "-";


                               const quantity =
                                   Number(
                                       item.quantity ||
                                       item.totalQuantity ||
                                       0
                                   );


                               return `
                                   <div class="summary-row">

                                       <span>

                                           ${getProductEmoji({
                                               name
                                           })}

                                           ${escapeHtml(
                                               name
                                           )}

                                       </span>

                                       <strong>
                                           ${quantity}
                                       </strong>

                                   </div>
                               `;

                           }
                       )
                       .join("");

           }

       }


       const paymentElement =
           document.getElementById(
               "analyticsPaymentMethods"
           );


       if (paymentElement) {

           if (!paymentMethods.length) {

               paymentElement.innerHTML = `
                   <div class="loading">
                       Belum ada data.
                   </div>
               `;

           } else {

               paymentElement.innerHTML =
                   paymentMethods
                       .map(
                           item => {

                               const method =
                                   String(
                                       item.method ||
                                       "-"
                                   ).toUpperCase();


                               const count =
                                   Number(
                                       item.count ||
                                       item.transactions ||
                                       item.total ||
                                       0
                                   );


                               return `
                                   <div class="summary-row">

                                       <span>
                                           ${escapeHtml(
                                               method
                                           )}
                                       </span>

                                       <strong>
                                           ${count}
                                       </strong>

                                   </div>
                               `;

                           }
                       )
                       .join("");

           }

       }

   }


   /* =========================================================
      TRANSACTIONS
      ========================================================= */


/* TRANSACTION HELPERS */
function getTransactionMethod(transaction = {}) {
    return String(
        transaction.paymentMethod ||
        transaction.payment?.method ||
        transaction.method ||
        ""
    ).toUpperCase() || "-";
}

function getTransactionStatus(transaction = {}) {
    return String(
        transaction.status ||
        transaction.orderStatus ||
        transaction.paymentStatus ||
        transaction.payment?.status ||
        ""
    ).toUpperCase() || "PENDING";
}

function getTransactionDate(transaction = {}) {
    return (
        transaction.date ||
        transaction.createdAt ||
        transaction.created_at ||
        transaction.paidAt ||
        transaction.payment?.paidAt ||
        null
    );
}


   async function loadTransactions() {

       const tableBody =
           document.getElementById(
               "transactionsTableBody"
           );


       if (tableBody) {

           tableBody.innerHTML = `
               <tr>
                   <td colspan="8">

                       <div class="loading">
                           Memuat transaksi...
                       </div>

                   </td>
               </tr>
           `;

       }


       try {

           const result =
               await apiFetch(
                   `/api/transactions?storeId=${STORE_ID}`
               );


           const data =
               result?.data || [];


           /*
            * Support beberapa bentuk response:
            *
            * data = []
            *
            * data = {
            *    transactions: []
            * }
            *
            * data = {
            *    orders: []
            * }
            */

           if (Array.isArray(data)) {

               transactions =
                   data;

           } else if (
               Array.isArray(
                   data.transactions
               )
           ) {

               transactions =
                   data.transactions;

           } else if (
               Array.isArray(
                   data.orders
               )
           ) {

               transactions =
                   data.orders;

           } else if (
               Array.isArray(
                   data.data
               )
           ) {

               transactions =
                   data.data;

           } else {

               transactions = [];

           }


           renderTransactionSummary(
               transactions
           );


           filterTransactions();


           console.log(
               "🧾 Transactions loaded:",
               transactions
           );


       } catch (error) {

           console.error(
               "TRANSACTIONS ERROR:",
               error
           );


           /*
            * Fallback ke dashboard
            * jika endpoint transaction
            * belum mengembalikan data.
            */

           try {

               const dashboard =
                   await apiFetch(
                       `/api/dashboard?storeId=${STORE_ID}`
                   );


               const recent =
                   dashboard?.data
                       ?.recentTransactions ||
                   [];


               transactions =
                   recent;


               renderTransactionSummary(
                   transactions
               );


               filterTransactions();


           } catch (fallbackError) {

               console.error(
                   "TRANSACTIONS FALLBACK ERROR:",
                   fallbackError
               );


               transactions = [];
               filteredTransactions = [];


               if (tableBody) {

                   tableBody.innerHTML = `
                       <tr>
                           <td colspan="8">

                               <div class="loading">

                                   Gagal mengambil
                                   data transaksi.

                                   <br>

                                   ${escapeHtml(
                                       error.message
                                   )}

                               </div>

                           </td>
                       </tr>
                   `;

               }


               updateTransactionResultCount();

           }

       }

   }


   /* =========================================================
      TRANSACTION SUMMARY
      ========================================================= */

   function renderTransactionSummary(
       data = []
   ) {
       const list = Array.isArray(data) ? data : [];

       // Endpoint transaksi menyediakan paymentStatus.
       // Fallback Dashboard hanya menyediakan order COMPLETED.
       const paidList = list.filter(transaction => {
           const paymentStatus = String(
               transaction.paymentStatus ||
               transaction.payment?.status ||
               ""
           ).toUpperCase();

           const orderStatus = String(
               transaction.status || ""
           ).toUpperCase();

           return orderStatus === "COMPLETED" &&
               (paymentStatus === "PAID" || !paymentStatus);
       });

       const totalCount = paidList.length;

       const totalRevenue = paidList.reduce(
           (sum, transaction) =>
               sum + Number(transaction.total || transaction.amount || 0),
           0
       );

       const cashTotal = paidList
           .filter(transaction =>
               String(
                   transaction.paymentMethod ||
                   transaction.payment?.method ||
                   transaction.method ||
                   ""
               ).toUpperCase() === "CASH"
           )
           .reduce(
               (sum, transaction) =>
                   sum + Number(transaction.total || transaction.amount || 0),
               0
           );

       const qrisTotal = paidList
           .filter(transaction =>
               String(
                   transaction.paymentMethod ||
                   transaction.payment?.method ||
                   transaction.method ||
                   ""
               ).toUpperCase() === "QRIS"
           )
           .reduce(
               (sum, transaction) =>
                   sum + Number(transaction.total || transaction.amount || 0),
               0
           );

       const countElement = document.getElementById("transactionTotalCount");
       const revenueElement = document.getElementById("transactionTotalRevenue");
       const cashElement = document.getElementById("transactionCashTotal");
       const qrisElement = document.getElementById("transactionQrisTotal");

       if (countElement) countElement.textContent = totalCount;
       if (revenueElement) revenueElement.textContent = formatRupiah(totalRevenue);
       if (cashElement) cashElement.textContent = formatRupiah(cashTotal);
       if (qrisElement) qrisElement.textContent = formatRupiah(qrisTotal);
   }


   /* =========================================================
      FILTER TRANSACTIONS
      ========================================================= */

   function filterTransactions() {

       const searchInput =
           document.getElementById(
               "transactionSearch"
           );


       const dateFilter =
           document.getElementById(
               "transactionDateFilter"
           );


       const paymentFilter =
           document.getElementById(
               "transactionPaymentFilter"
           );


       const statusFilter =
           document.getElementById(
               "transactionStatusFilter"
           );


       const search =
           (
               searchInput?.value ||
               ""
           )
               .trim()
               .toLowerCase();


       const selectedDate =
           dateFilter?.value ||
           "";


       const selectedPayment =
           paymentFilter?.value ||
           "ALL";


       const selectedStatus =
           statusFilter?.value ||
           "ALL";


       filteredTransactions =
           transactions.filter(
               transaction => {

                   const orderNumber =
                       String(
                           transaction.orderNumber ||
                           transaction.order ||
                           transaction.id ||
                           ""
                       ).toLowerCase();


                   const method =
                       getTransactionMethod(
                           transaction
                       );


                   const status =
                       getTransactionStatus(
                           transaction
                       );


                   const dateValue =
                       getTransactionDate(
                           transaction
                       );

                        const customerName = String(
                            transaction.customerName ||
                            transaction.customer?.name ||
                            ""
                        ).toLowerCase();

                        const customerPhone = String(
                            transaction.customerPhone ||
                            transaction.customer?.phone ||
                            ""
                        ).toLowerCase();

                        const matchesSearch =
                            !search ||
                            orderNumber.includes(search) ||
                            customerName.includes(search) ||
                            customerPhone.includes(search);

                   const matchesPayment =
                       selectedPayment ===
                           "ALL" ||
                       method ===
                           selectedPayment;


                   const matchesStatus =
                       selectedStatus ===
                           "ALL" ||
                       status ===
                           selectedStatus;


                           let matchesDate = true;

                           if (selectedDate && dateValue) {
                             const date = new Date(dateValue);

                             if (!Number.isNaN(date.getTime())) {

                               const now = new Date();

                               // Normalisasi tanggal transaksi
                               const transactionDate = new Date(date);
                               transactionDate.setHours(0, 0, 0, 0);

                               // Normalisasi tanggal hari ini
                               const today = new Date();
                               today.setHours(0, 0, 0, 0);

                               if (selectedDate === "TODAY") {

                                 matchesDate =
                                   transactionDate.getTime() ===
                                   today.getTime();

                               } else if (selectedDate === "WEEK") {

                                 const startOfWeek = new Date(today);

                                 // Senin sebagai awal minggu
                                 const day = startOfWeek.getDay();

                                 const diff =
                                   day === 0
                                     ? 6
                                     : day - 1;

                                 startOfWeek.setDate(
                                   startOfWeek.getDate() - diff
                                 );

                                 matchesDate =
                                   transactionDate >=
                                   startOfWeek &&
                                   transactionDate <=
                                   today;

                               } else if (selectedDate === "MONTH") {

                                 const startOfMonth =
                                   new Date(
                                     today.getFullYear(),
                                     today.getMonth(),
                                     1
                                   );

                                 matchesDate =
                                   transactionDate >=
                                   startOfMonth &&
                                   transactionDate <=
                                   today;

                               } else if (selectedDate === "ALL") {

                                 matchesDate = true;

                               } else {

                                 // Untuk filter tanggal YYYY-MM-DD
                                 const localDate =
                                   date.toLocaleDateString(
                                     "en-CA"
                                   );

                                 matchesDate =
                                   localDate === selectedDate;
                               }
                             }
                           }


                   return (
                       matchesSearch &&
                       matchesDate &&
                       matchesPayment &&
                       matchesStatus
                   );

               }
           );


       renderTransactions(
           filteredTransactions
       );


       updateTransactionResultCount();

   }


   /* =========================================================
      RENDER TRANSACTIONS
      ========================================================= */

   function renderTransactions(
       data = []
   ) {

       const tableBody =
           document.getElementById(
               "transactionsTableBody"
           );


       if (!tableBody) return;


       if (!data.length) {

           tableBody.innerHTML = `
               <tr>

                   <td colspan="8">

                       <div class="loading">
                           Tidak ada transaksi yang sesuai.
                       </div>

                   </td>

               </tr>
           `;


           return;
       }


       tableBody.innerHTML =
           data
               .map(
                   transaction =>
                       renderTransactionRow(
                           transaction
                       )
               )
               .join("");

   }


   /* =========================================================
      TRANSACTION ROW
      ========================================================= */

   function renderTransactionRow(
       transaction
   ) {

       const orderNumber =
           transaction.orderNumber ||
           transaction.order ||
           transaction.id ||
           "-";


       const total =
           Number(
               transaction.total ||
               transaction.amount ||
               0
           );


       const method =
           getTransactionMethod(
               transaction
           );


       const status =
           getTransactionStatus(
               transaction
           );


       const dateValue =
           getTransactionDate(
               transaction
           );


       let dateText = "-";


       if (dateValue) {

           const date =
               new Date(
                   dateValue
               );


           if (
               !Number.isNaN(
                   date.getTime()
               )
           ) {

               dateText =
                   date.toLocaleString(
                       "id-ID",
                       {
                           day: "2-digit",
                           month: "2-digit",
                           year: "numeric",
                           hour: "2-digit",
                           minute: "2-digit"
                       }
                   );

           }

       }


       const methodIcon =
           method === "CASH"
               ? "💵"
               : method === "QRIS"
                   ? "📱"
                   : "💳";


       const normalizedStatus = String(status).toUpperCase();

       const statusClass =
           normalizedStatus === "PAID" ||
           normalizedStatus === "COMPLETED"
               ? "completed"
               : ["PENDING", "PROCESSING", "CANCELLED", "REFUNDED"]
                   .includes(normalizedStatus)
                   ? normalizedStatus.toLowerCase()
                   : "pending";


                   const itemCount =
                   Array.isArray(transaction.items)
                       ? transaction.items.reduce(
                           (total, item) =>
                               total + Number(item.quantity || 0),
                           0
                       )
                       : Number(transaction.itemCount || 0);

               const customerName =
                   transaction.customerName ||
                   transaction.customer?.name ||
                   transaction.customer?.fullName ||
                   "Pelanggan Umum";


                const isRegisteredCustomer =
                transaction.isRegisteredCustomer === true;

                const customerBadge = isRegisteredCustomer
                ? '<span class="customer-badge">⭐ </span>'
                : '';

       return `
           <tr
               class="transaction-row"
               data-transaction-id="${escapeHtml(
                   transaction.id ||
                   orderNumber
               )}">

            <td>
                <strong>${escapeHtml(orderNumber)}</strong>
            </td>

            <td>
                <span>${escapeHtml(dateText)}</span>
            </td>

            <td>
                <span class="transaction-customer">
                    ${escapeHtml(customerName)}
                    ${customerBadge}
                </span>
            </td>

            <td>
                <span>${itemCount || 0}</span>
            </td>

            <td>
                <strong>${formatRupiah(total)}</strong>
            </td>

            <td>
                <span>
                    ${methodIcon}
                    ${escapeHtml(method)}
                </span>
            </td>

            <td>
                <span class="transaction-status ${statusClass}">
                    ${escapeHtml(status)}
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="transaction-detail-btn"
                    onclick="showTransactionDetail('${escapeHtml(
                        transaction.id || orderNumber
                    )}')"
                >
                    Detail
                </button>
            </td>
        </tr>
    `;

   }


   /* =========================================================
      UPDATE TRANSACTION COUNT
      ========================================================= */

   function updateTransactionResultCount() {

       const element =
           document.getElementById(
               "transactionResultCount"
           );


       if (!element) return;


       element.textContent =
           `${filteredTransactions.length} transaksi`;

   }


   /* =========================================================
      SHOW TRANSACTION DETAIL
      ========================================================= */

   async function showTransactionDetail(id) {
       let transaction = transactions.find(item =>
           String(item.id || item.orderNumber) === String(id)
       );

       if (!transaction) {
           showToast("Detail transaksi tidak ditemukan", "error");
           return;
       }

       const modal = document.getElementById("transactionDetailModal");
       if (!modal) {
           console.log("Transaction detail:", transaction);
           return;
       }

       const detailContent = document.getElementById("transactionDetailContent");
       if (detailContent) {
           detailContent.innerHTML = '<div class="loading">Memuat detail transaksi...</div>';
       }

       modal.classList.remove("hidden");
       modal.classList.add("active");

       try {
           const result = await apiFetch(
               `/api/transactions/${encodeURIComponent(transaction.id)}?storeId=${encodeURIComponent(STORE_ID)}`
           );

           if (result?.data) {
               transaction = result.data;
           }
       } catch (error) {
           console.error("Gagal mengambil detail transaksi terbaru:", error);
           // Tetap tampilkan data daftar transaksi bila endpoint detail gagal.
       }

       const orderNumber =
           transaction.orderNumber || transaction.order || transaction.id || "-";

       const dateValue = getTransactionDate(transaction);
       let dateText = "-";

       if (dateValue) {
           const date = new Date(dateValue);
           if (!Number.isNaN(date.getTime())) {
               dateText = date.toLocaleString("id-ID", {
                   day: "2-digit",
                   month: "long",
                   year: "numeric",
                   hour: "2-digit",
                   minute: "2-digit"
               });
           }
       }

       const detailOrderNumber = document.getElementById("detailOrderNumber");
       const detailDate = document.getElementById("detailDate");

       if (detailOrderNumber) detailOrderNumber.textContent = orderNumber;
       if (detailDate) detailDate.textContent = dateText;

       if (!detailContent) return;

       const items = Array.isArray(transaction.items) ? transaction.items : [];
       const total = Number(transaction.total ?? transaction.amount ?? 0);
       const method = getTransactionMethod(transaction);
       const status = getTransactionStatus(transaction);
       const normalizedStatus = String(status).toUpperCase();

       const detailStatusClass =
           normalizedStatus === "PAID" || normalizedStatus === "COMPLETED"
               ? "completed"
               : ["PENDING", "PROCESSING", "CANCELLED", "REFUNDED"].includes(normalizedStatus)
                   ? normalizedStatus.toLowerCase()
                   : "pending";

       const customerName =
           transaction.customerName || transaction.customer?.name || "Pelanggan Umum";

       const refunds = Array.isArray(transaction.refunds) ? transaction.refunds : [];
       const refundedTotal = Number(
           transaction.refundedTotal ??
           refunds.filter(refund => String(refund.status).toUpperCase() === "COMPLETED")
               .reduce((sum, refund) => sum + Number(refund.amount || 0), 0)
       );

       const refundHistory = refunds.length
           ? `
               <div class="transaction-detail-refunds">
                   <h4>Riwayat Refund</h4>
                   ${refunds.map(refund => {
                       const refundStatus = String(refund.status || "PENDING").toUpperCase();
                       const refundDate = refund.completedAt || refund.createdAt;
                       let formattedDate = "-";

                       if (refundDate) {
                           const parsedDate = new Date(refundDate);
                           if (!Number.isNaN(parsedDate.getTime())) {
                               formattedDate = parsedDate.toLocaleString("id-ID", {
                                   day: "2-digit",
                                   month: "short",
                                   year: "numeric",
                                   hour: "2-digit",
                                   minute: "2-digit"
                               });
                           }
                       }

                       return `
                           <div class="summary-row">
                               <span>
                                   ${escapeHtml(refund.reason || "Refund")}
                                   <small>${escapeHtml(formattedDate)} · ${escapeHtml(refundStatus)}</small>
                               </span>
                               <strong>${formatRupiah(Number(refund.amount || 0))}</strong>
                           </div>
                           ${refundStatus === "PENDING" ? `
                               <div class="refund-action-row">
                                   <button type="button" class="refund-confirm-btn"
                                       data-refund-action="confirm"
                                       data-refund-id="${escapeHtml(refund.id)}">Konfirmasi</button>
                                   <button type="button" class="refund-cancel-btn"
                                       data-refund-action="cancel"
                                       data-refund-id="${escapeHtml(refund.id)}">Batalkan</button>
                               </div>
                           ` : ""}
                       `;
                   }).join("")}
               </div>
           `
           : `
               <div class="transaction-detail-refunds">
                   <h4>Riwayat Refund</h4>
                   <div class="summary-row"><span>Belum ada refund</span><strong>—</strong></div>
               </div>
           `;

       const canRequestRefund =
           String(transaction.status || "").toUpperCase() === "COMPLETED" &&
           String(transaction.paymentStatus || "").toUpperCase() === "PAID";

       const reservedRefund = refunds
           .filter(refund => ["PENDING", "COMPLETED"].includes(
               String(refund.status || "").toUpperCase()
           ))
           .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

       const remainingRefund = Math.max(0, total - reservedRefund);

       detailContent.innerHTML = `
           <div class="transaction-detail-customer">
               <span>Nama Pelanggan</span>
               <strong>${escapeHtml(customerName)}</strong>
           </div>

           <div class="transaction-detail-summary">
               <div>
                   <span>Payment</span>
                   <strong>${escapeHtml(method)}</strong>
               </div>
               <div>
                   <span>Status</span>
                   <span class="transaction-status ${detailStatusClass}">${escapeHtml(status)}</span>
               </div>
           </div>

           <div class="transaction-detail-items">
               ${items.length ? items.map(item => {
                   const name = item.productName || item.product?.name || item.name || "-";
                   const quantity = Number(item.quantity || 0);
                   const subtotal = Number(item.subtotal ?? (Number(item.price || 0) * quantity));

                   return `
                       <div class="summary-row">
                           <span>${escapeHtml(name)} × ${quantity}</span>
                           <strong>${formatRupiah(subtotal)}</strong>
                       </div>
                   `;
               }).join("") : '<div class="loading">Detail item tidak tersedia.</div>'}
           </div>

           <div class="transaction-detail-total">
               <span>Total Transaksi</span>
               <strong>${formatRupiah(total)}</strong>
           </div>

           ${refundHistory}

           <div class="transaction-detail-total refund-total-compact">
               <span>Total Refund Selesai</span>
               <strong>${formatRupiah(refundedTotal)}</strong>
           </div>

           ${canRequestRefund && remainingRefund > 0 ? `
                                  <form id="refundRequestForm" class="refund-request-form">
                       <p>Sisa refund: <strong>${formatRupiah(remainingRefund)}</strong></p>
                       <label for="refundAmount">Nominal refund (Rp)</label>
                       <input id="refundAmount" name="amount" type="number"
                           min="0.01" max="${remainingRefund}" step="0.01"
                           placeholder="Masukkan nominal" required>
                       <label for="refundReason">Alasan refund</label>
                       <textarea id="refundReason" name="reason" rows="2"
                           maxlength="500" placeholder="Jelaskan alasan refund..." required></textarea>
                       <button type="submit" class="refund-submit-btn">Ajukan Refund</button>
                   </form>
           ` : ""}
       `;

       const refundForm = document.getElementById("refundRequestForm");
       if (refundForm) {
           refundForm.addEventListener("submit", async event => {
               event.preventDefault();
               const formData = new FormData(refundForm);
               const amount = Number(formData.get("amount"));
               const reason = String(formData.get("reason") || "").trim();

               if (!Number.isFinite(amount) || amount <= 0 || amount > remainingRefund) {
                   showToast("Nominal refund melebihi sisa yang tersedia.", "error");
                   return;
               }
               if (!reason) {
                   showToast("Alasan refund wajib diisi.", "error");
                   return;
               }

               const submitButton = refundForm.querySelector('[type="submit"]');
               if (submitButton) {
                   submitButton.disabled = true;
                   submitButton.textContent = "Mengajukan...";
               }

               try {
                   const result = await apiFetch(
                       `/api/transactions/${encodeURIComponent(transaction.id)}/refunds?storeId=${encodeURIComponent(STORE_ID)}`,
                       {
                           method: "POST",
                           headers: { "Content-Type": "application/json" },
                           body: JSON.stringify({ amount, reason })
                       }
                   );
                   showToast(result.message || "Pengajuan refund berhasil dibuat.", "success");
                   await refreshTransactionsAfterRefund(transaction.id);
               } catch (error) {
                   console.error("Gagal mengajukan refund:", error);
                   showToast(error.message || "Gagal mengajukan refund.", "error");
                   if (submitButton) {
                       submitButton.disabled = false;
                       submitButton.textContent = "Ajukan Refund";
                   }
               }
           });
       }

       detailContent.querySelectorAll("[data-refund-action]").forEach(button => {
           button.addEventListener("click", async () => {
               const action = button.dataset.refundAction;
               const refundId = button.dataset.refundId;
               if (!refundId || !["confirm", "cancel"].includes(action)) return;

               const confirmed = await showRefundConfirmDialog({
                   title: action === "confirm" ? "Konfirmasi Refund" : "Batalkan Refund",
                   message: action === "confirm"
                       ? "Pastikan dana sudah benar-benar dikembalikan kepada pelanggan sebelum mengonfirmasi."
                       : "Pengajuan refund ini akan dibatalkan. Kamu yakin ingin melanjutkan?",
                   confirmText: action === "confirm" ? "Ya, Konfirmasi" : "Ya, Batalkan",
                   danger: action === "cancel"
               });
               if (!confirmed) return;

               button.disabled = true;
               try {
                   const result = await apiFetch(
                       `/api/transactions/${encodeURIComponent(transaction.id)}/refunds/${encodeURIComponent(refundId)}/${action}?storeId=${encodeURIComponent(STORE_ID)}`,
                       { method: "POST" }
                   );
                   showToast(result.message || "Status refund diperbarui.", "success");
                   await refreshTransactionsAfterRefund(transaction.id);
               } catch (error) {
                   console.error("Gagal memproses refund:", error);
                   showToast(error.message || "Gagal memproses refund.", "error");
                   button.disabled = false;
               }
           });
       });
   }


   /* =========================================================
      CLOSE TRANSACTION DETAIL
      ========================================================= */


function showRefundConfirmDialog({
    title = "Konfirmasi",
    message = "Lanjutkan tindakan ini?",
    confirmText = "Konfirmasi",
    danger = false
} = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "refund-confirm-overlay";
        overlay.innerHTML = `
            <section class="refund-confirm-dialog" role="dialog"
                aria-modal="true" aria-labelledby="refundConfirmTitle">
                <div class="refund-confirm-icon" aria-hidden="true">
                    ${danger ? "!" : "✓"}
                </div>
                <h3 id="refundConfirmTitle"></h3>
                <p class="refund-confirm-message"></p>
                <div class="refund-confirm-buttons">
                    <button type="button" class="refund-dialog-back">Kembali</button>
                    <button type="button" class="refund-dialog-accept"></button>
                </div>
            </section>
        `;

        overlay.querySelector("#refundConfirmTitle").textContent = title;
        overlay.querySelector(".refund-confirm-message").textContent = message;

        const accept = overlay.querySelector(".refund-dialog-accept");
        accept.textContent = confirmText;
        if (danger) accept.classList.add("is-danger");

        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            document.removeEventListener("keydown", onKeyDown);
            overlay.remove();
            resolve(value);
        };

        const onKeyDown = event => {
            if (event.key === "Escape") finish(false);
        };

        overlay.querySelector(".refund-dialog-back")
            .addEventListener("click", () => finish(false));
        accept.addEventListener("click", () => finish(true));
        overlay.addEventListener("click", event => {
            if (event.target === overlay) finish(false);
        });

        document.addEventListener("keydown", onKeyDown);
        document.body.appendChild(overlay);
        accept.focus();
    });
}

async function refreshTransactionsAfterRefund(transactionId) {
    // Perbarui daftar transaksi dari backend tanpa refresh browser.
    try {
        await loadTransactions();
    } catch (error) {
        console.warn("Daftar transaksi gagal diperbarui:", error);
    }

    // Ambil kembali detail terbaru agar status dan riwayat refund sinkron.
    await showTransactionDetail(transactionId);
}

function closeTransactionDetail() {
    const modal = document.getElementById("transactionDetailModal");

    if (!modal) return;

    modal.classList.remove("active");
    modal.classList.add("hidden");
}

   /* =========================================================
      PRINT TRANSACTION
      ========================================================= */

async function printCurrentTransaction() {
    const receiptSettings = window.getReceiptSettings();
    const modal = document.getElementById("transactionDetailModal");
    const content = document.getElementById("transactionDetailContent");

    const orderNumber =
        document.getElementById("detailOrderNumber")?.textContent?.trim() || "-";

    const dateText =
        document.getElementById("detailDate")?.textContent?.trim() || "-";

    if (!modal || !content) return;

    const transaction = transactions.find(item =>
        String(item.orderNumber || item.order || item.id) === String(orderNumber)
    );

    const existingCustomerName = content
        .querySelector(".transaction-detail-customer strong")
        ?.textContent?.trim();

    const customerName =
        transaction?.customerName ||
        transaction?.customer?.name ||
        existingCustomerName ||
        "Pelanggan Umum";

    const printableContent = content.cloneNode(true);

    // Rincian subtotal, diskon, pajak, dan biaya hanya ditambahkan ke salinan cetak.
    const receiptNumber = value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const receiptItems = Array.isArray(transaction?.items)
        ? transaction.items
        : [];

    const receiptSubtotal = receiptNumber(transaction?.subtotal) ||
        receiptItems.reduce((sum, item) => {
            const quantity = receiptNumber(item.quantity);
            const price = receiptNumber(item.price);
            return sum + receiptNumber(item.subtotal || price * quantity);
        }, 0);

    const receiptDiscount = receiptNumber(transaction?.discount);
    const receiptPointsDiscount = receiptNumber(transaction?.pointsDiscount);
    const receiptTax = receiptNumber(transaction?.tax);
    const receiptServiceCharge = receiptNumber(transaction?.serviceCharge);

    const formatReceiptPercent = value =>
        Number(value.toFixed(2)).toString();

    const receiptDiscountPercent = receiptSubtotal > 0
        ? receiptDiscount / receiptSubtotal * 100
        : 0;

    const receiptTaxBase = Math.max(
        0,
        receiptSubtotal - receiptDiscount - receiptPointsDiscount
    );

    const receiptTaxPercent = receiptTaxBase > 0
        ? receiptTax / receiptTaxBase * 100
        : 0;

    const hasReceiptAdjustments =
        receiptDiscount !== 0 ||
        receiptPointsDiscount !== 0 ||
        receiptTax !== 0 ||
        receiptServiceCharge !== 0;

    if (hasReceiptAdjustments) {
        const printSummary = document.createElement("div");
        printSummary.className = "transaction-detail-print-summary";

        const rows = [
            ["Subtotal", receiptSubtotal],
            [
                receiptDiscount
                    ? `Diskon (${formatReceiptPercent(receiptDiscountPercent)}%)`
                    : "Diskon",
                -receiptDiscount
            ],
            ["Diskon Poin", -receiptPointsDiscount],
            [
                receiptTax
                    ? `Pajak (${formatReceiptPercent(receiptTaxPercent)}%)`
                    : "Pajak",
                receiptTax
            ],
            ["Biaya Layanan", receiptServiceCharge]
        ].filter((row, index) => index === 0 || row[1] !== 0);

        rows.forEach(([label, amount]) => {
            const row = document.createElement("div");
            row.className = "summary-row";

            const labelElement = document.createElement("span");
            labelElement.textContent = label;

            const amountElement = document.createElement("strong");
            amountElement.textContent =
                `${amount < 0 ? "- " : ""}${formatRupiah(Math.abs(amount))}`;

            row.append(labelElement, amountElement);
            printSummary.appendChild(row);
        });

        const totalRow = printableContent.querySelector(
            ".transaction-detail-total:not(.refund-total-compact)"
        );

        if (totalRow) {
            totalRow.parentNode.insertBefore(printSummary, totalRow);
        }
    }

    // Nama pelanggan ditampilkan di header struk saja.
    printableContent
        .querySelector(".transaction-detail-customer")
        ?.remove();

    const printWindow = window.open(
        "",
        "_blank",
        "width=420,height=700"
    );

    if (!printWindow) {
        showToast("Popup print diblokir browser", "error");
        return;
    }

    let storeProfile = {};
    let storeLogoUrl = "";

    try {
        const storeResult = await apiFetch(
            "/api/stores/" + encodeURIComponent(STORE_ID)
        );
        if (storeResult?.success && storeResult.data) {
            storeProfile = storeResult.data;
        }
    } catch (error) {
        console.warn("Profil toko cetak ulang tidak dapat dimuat:", error);
    }

    try {
        const logoResult = await apiFetch(
            "/api/stores/" + encodeURIComponent(STORE_ID) + "/logo"
        );
        if (logoResult?.success && logoResult.data) {
            storeLogoUrl = logoResult.data.logoUrl || "";
        }
    } catch (error) {
        console.warn("Logo cetak ulang tidak dapat dimuat:", error);
    }

    const receiptStoreName =
        String(receiptSettings.storeName || "").trim() ||
        storeProfile.name || "SmartPOS";
    const receiptStoreAddress =
        String(receiptSettings.storeAddress || "").trim() ||
        storeProfile.address || "";
    const receiptStorePhone =
        String(receiptSettings.storePhone || "").trim() ||
        storeProfile.phone || "";

    const receiptLogoHTML = !receiptSettings.showLogo
        ? ""
        : storeLogoUrl
            ? '<img class="receipt-logo" src="' +
                escapeHtml(logoImageUrl(storeLogoUrl)) +
                '" alt="Logo toko">'
            : '<div class="brand-mark">S</div>';

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Struk ${escapeHtml(orderNumber)}</title>

            <style>
                @page {
                    size: ${receiptSettings.paperSize}mm auto;
                    margin: 0;
                }

                * {
                    box-sizing: border-box;
                }

                html,
                body {
                    width: ${receiptSettings.paperSize}mm;
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    color: #171717;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 10px;
                    line-height: 1.45;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                body {
                    padding: 4mm 3.5mm;
                }

                .receipt {
                    width: 100%;
                    margin: 0 auto;
                }

.brand {
    text-align: center;
    padding: 0 0 1mm;
}

.receipt-logo {
    display: block;
    width: 42px;
    height: 42px;
    max-width: 100%;
    object-fit: contain;
    margin: 0 auto 3px;
}

.brand-mark {
    width: 28px;
    height: 28px;
    margin: 0 auto 3px;
    border: 1.5px solid #171717;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -1px;
}

.brand h1 {
    margin: 0;
    font-size: 17px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: 1px;
}
                .brand .tagline {
    margin: 3px 0 0;
    font-size: 8px;
    font-weight: 400;
    letter-spacing: normal;
    text-transform: none;
    line-height: 1.3;
}
                .divider {
                    border: 0;
                    border-top: 1px dashed #777;
                    margin: 3mm 0;
                }

                .section-label {
                    margin: 0 0 2mm;
                    font-size: 8px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }

                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 8px;
                    margin: 1.5mm 0;
                }

                .meta-row span {
                    color: #555;
                    flex: 0 0 auto;
                }

                .meta-row strong {
                    text-align: right;
                    overflow-wrap: anywhere;
                    font-weight: 700;
                }

               .customer {
    padding: 1mm 0 0;
    margin: 0;
    text-align: center;
    border: none;
}

.customer .customer-label {
    font-size: 7px;
    color: #555;
    text-transform: uppercase;
    letter-spacing: .7px;
}

.customer .customer-name {
    margin-top: 0;
    font-size: 9px;
    font-weight: 600;
    overflow-wrap: anywhere;
    text-align: center;
}

                .customer .customer-label {
                 font-size: 8px;
                color: #555;
                text-transform: uppercase;
                letter-spacing: .7px;
                }

                .customer .customer-name {
                 margin-top: 1mm;
                font-size: 12px;
                font-weight: 800;
                overflow-wrap: anywhere;
                }

                .transaction-detail-summary {
                    display: block !important;
                    margin: 2mm 0;
                }

                .transaction-detail-summary > div {
                    display: flex !important;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 1.5mm 0;
                }

                .transaction-detail-summary span {
                    color: #555;
                }

                .transaction-detail-summary strong {
                    text-align: right;
                    overflow-wrap: anywhere;
                }

                .summary-row {
                    display: flex !important;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 2mm 0;
                    border-bottom: 1px dashed #ddd;
                    break-inside: avoid;
                }

                .summary-row > *:last-child {
                    text-align: right;
                }

                .transaction-detail-items,
                .transaction-detail-list,
                .transaction-items {
                    width: 100%;
                }

                .transaction-detail-total {
                    display: flex !important;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 8px;
                    margin-top: 3mm;
                    padding: 3mm 0;
                    border-top: 1.5px solid #171717;
                    border-bottom: 1.5px solid #171717;
                    font-size: 13px;
                    font-weight: 800;
                    break-inside: avoid;
                }

                .transaction-detail-total > *:last-child {
                    text-align: right;
                    overflow-wrap: anywhere;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9px;
                }

                th,
                td {
                    padding: 2mm 0;
                    text-align: left;
                    vertical-align: top;
                    overflow-wrap: anywhere;
                }

                th:last-child,
                td:last-child {
                    text-align: right;
                }

                tr {
                    break-inside: avoid;
                }

                img {
                    max-width: 100%;
                }

                .receipt-footer {
    text-align: center;
    padding-top: 2mm;
}

.receipt-footer .thanks {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .2px;
    margin: 0 0 1mm;
}

.receipt-footer p {
    font-size: 7px;
    line-height: 1.2;
    color: #555;
    margin: 0.5mm 0;
}

.receipt-footer .brand-footer {
    margin-top: 1.5mm;
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 1px;
}
                @media screen {
                    body {
                        margin: 12px auto;
                        box-shadow: 0 2px 18px rgba(0, 0, 0, .12);
                        min-height: 100vh;
                    }
                }
            </style>
        </head>

        <body>
            <div class="receipt-print-toolbar">
                <button type="button" onclick="window.focus(); window.print();">Cetak Struk</button>
            </div>
            <main class="receipt">
                <header class="brand">
                    ${receiptLogoHTML}
                    <h1>${escapeHtml(receiptStoreName)}</h1>
                    ${receiptSettings.showAddress && receiptStoreAddress ? '<p class="tagline">' + escapeHtml(receiptStoreAddress) + '</p>' : ""}
                    ${receiptSettings.showPhone && receiptStorePhone ? '<p class="tagline">' + escapeHtml(receiptStorePhone) + '</p>' : ""}
                    ${receiptSettings.showCustomer ? `
                        <div class="customer">
                            <div class="customer-label">Pelanggan</div>
                            <div class="customer-name">${escapeHtml(customerName)}</div>
                        </div>
                    ` : ""}
                </header>

                <hr class="divider">

                <section>
                    <p class="section-label">Informasi Transaksi</p>

                    <div class="meta-row">
                        <span>No. Pesanan</span>
                        <strong>${escapeHtml(orderNumber)}</strong>
                    </div>

                    <div class="meta-row">
                        <span>Tanggal</span>
                        <strong>${escapeHtml(dateText)}</strong>
                    </div>
                </section>

                <hr class="divider">

                <section class="transaction-body">
                    ${printableContent.innerHTML}
                </section>

                <hr class="divider">

                <footer class="receipt-footer">
                    <p class="thanks">Terima Kasih!</p>
                    ${receiptSettings.footerMessage ? '<p class="receipt-custom-footer">' + escapeHtml(receiptSettings.footerMessage).replace(/\n/g, "<br>") + '</p>' : ""}
                    <p>Simpan struk ini sebagai bukti transaksi.</p>
                    <div class="brand-footer">${escapeHtml(receiptStoreName)}</div>
                </footer>
            </main>

            <script>
                window.onload = function () {
                    setTimeout(function () {
                        window.focus();
                        window.print();
                    }, 350);
                };

                window.onafterprint = function () {
                    window.close();
                };
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
}


   /* =========================================================
      TRANSACTION EVENTS
      ========================================================= */

   function setupTransactionEvents() {

       const search =
           document.getElementById(
               "transactionSearch"
           );


       const date =
           document.getElementById(
               "transactionDateFilter"
           );


       const payment =
           document.getElementById(
               "transactionPaymentFilter"
           );


       const status =
           document.getElementById(
               "transactionStatusFilter"
           );


       search?.addEventListener(
           "input",
           filterTransactions
       );


       date?.addEventListener(
           "change",
           filterTransactions
       );


       payment?.addEventListener(
           "change",
           filterTransactions
       );


       status?.addEventListener(
           "change",
           filterTransactions
       );


       const refreshButton =
           document.getElementById(
               "refreshTransactionsBtn"
           );


       refreshButton?.addEventListener(
           "click",
           loadTransactions
       );


       const printButton =
           document.getElementById(
               "printTransactionBtn"
           );


       printButton?.addEventListener(
           "click",
           printCurrentTransaction
       );


       const modal =
           document.getElementById(
               "transactionDetailModal"
           );


       if (modal) {

           modal.addEventListener(
               "click",
               event => {

                   if (
                       event.target ===
                       modal
                   ) {

                       closeTransactionDetail();

                   }

               }
           );

       }


       const closeDetailButton = document.getElementById(
        "closeTransactionDetail"
    );


    closeDetailButton?.addEventListener(
        "click",
        closeTransactionDetail
    );

    // CETAK STRUK DARI POS
    const printPOSReceiptButton = document.getElementById(
        "printPOSReceiptBtn"
    );

    printPOSReceiptButton?.addEventListener(
        "click",
        printPOSReceipt
    );

    }


   /* =========================================================
      NAVIGATION
      ========================================================= */

   function setupNavigation() {

       const navItems =
           document.querySelectorAll(
               ".nav-item"
           );


       navItems.forEach(
           item => {

               item.addEventListener(
                   "click",
                   () => {

                       const section =
                           item.dataset.section;


                       /* =========================================
                          ACTIVE NAV
                          ========================================= */

                       navItems.forEach(
                           nav =>
                               nav.classList.remove(
                                   "active"
                               )
                       );


                       item.classList.add(
                           "active"
                       );


                       /* =========================================
                          HIDE ALL SECTIONS
                          ========================================= */

                       document
                           .querySelectorAll(
                               ".section"
                           )
                           .forEach(
                               sectionElement =>
                                   sectionElement.classList.remove(
                                       "active"
                                   )
                           );


                       /* =========================================
                          SHOW TARGET
                          ========================================= */

                       const target =
                           document.getElementById(
                               `${section}Section`
                           );


                       if (target) {

                           target.classList.add(
                               "active"
                           );

                       }


                       updatePageHeader(
                           section
                       );


                       /* =========================================
                          DASHBOARD
                          ========================================= */

                       if (
                           section ===
                           "dashboard"
                       ) {

                           loadDashboard();

                       }


                       /* =========================================
                          INVENTORY
                          ========================================= */

                       if (
                           section ===
                           "inventory"
                       ) {

                           loadInventory();

                       }


                       /* =========================================
                          TRANSACTIONS
                          ========================================= */

                       if (
                           section ===
                           "transactions"
                       ) {

                           loadTransactions();

                       }


                       /* =========================================
                          ANALYTICS
                          ========================================= */

                       if (
                           section ===
                           "analytics"
                       ) {

                           loadAnalytics(
                               7
                           );

                       }


                       /* =========================================
                          FUTURE
                          ========================================= */


                        if (section === "customers") {
                             setupCustomersPage();

                             loadCustomers(
                         document.getElementById("customerSearchInput")?.value || ""
                         );
                        }

                        if (section === "expenses") {
                            loadExpenses();
                        }

                       if (section === "prediction") { loadPrediction(); }

                       if (section === "reports") { loadReports(); }



                   }
               );

           }
       );

   }


/* =========================================================
   SETTINGS NAVIGATION
   ========================================================= */


   function applyAppTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = selectedTheme;

    try {
        localStorage.setItem("smartpos_theme", selectedTheme);
    } catch (error) {
        console.warn("Preferensi tema tidak dapat disimpan.", error);
    }
}

function setupThemeSettings() {
    const choices = document.querySelectorAll(
        'input[name="appearanceThemeChoice"]'
    );
    let savedTheme = "light";

    try {
        savedTheme = localStorage.getItem("smartpos_theme") || "light";
    } catch (error) {
        console.warn("Preferensi tema tidak dapat dibaca.", error);
    }

    savedTheme = savedTheme === "dark" ? "dark" : "light";
    applyAppTheme(savedTheme);

    choices.forEach(choice => {
        choice.checked = choice.value === savedTheme;
        if (choice.dataset.themeReady === "true") return;

        choice.addEventListener("change", () => {
            if (!choice.checked) return;
            applyAppTheme(choice.value);
            updateAppearanceThemeCards();
        });

        choice.dataset.themeReady = "true";
    });

    updateAppearanceThemeCards();
}

function updateAppearanceThemeCards() {
    document.querySelectorAll(".appearance-theme-card").forEach(card => {
        const radio = card.querySelector(
            'input[name="appearanceThemeChoice"]'
        );
        card.classList.toggle("selected", !!radio && radio.checked);
    });
}





async function renderUserManagementSettings(container) {
    container.replaceChildren();
    const currentUser = getStoredUser();
    const isGuest = currentUser?.isGuest === true;

    const panel = document.createElement("div");
    panel.className = "user-management-panel";

    const intro = document.createElement("div");
    intro.className = "user-management-intro";

    const introTitle = document.createElement("h3");
    introTitle.textContent = "Kelola pengguna";

    const introText = document.createElement("p");
    introText.textContent =
        "Tambah akun, atur hak akses, ubah status, atau ganti kata sandi.";

    intro.append(introTitle, introText);

    const feedback = document.createElement("div");
    feedback.className = "user-management-feedback";
    feedback.hidden = true;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");

    function showFeedback(message, type = "") {
        feedback.textContent = message;
        feedback.className =
            "user-management-feedback" + (type ? " is-" + type : "");
        feedback.hidden = !message;
    }

    function makeInput(type, name, placeholder, value = "") {
        const input = document.createElement("input");
        input.type = type;
        input.name = name;
        input.placeholder = placeholder;
        input.value = value;
        input.className = "user-management-input";
        return input;
    }

    function makeSelect(name, options, selectedValue) {
        const select = document.createElement("select");
        select.name = name;
        select.className = "user-management-input";

        options.forEach(item => {
            const option = document.createElement("option");
            option.value = item.value;
            option.textContent = item.label;
            select.appendChild(option);
        });

        select.value = String(selectedValue);
        return select;
    }

    function makeField(labelText, control) {
        const wrapper = document.createElement("label");
        wrapper.className = "user-management-field";

        const label = document.createElement("span");
        label.textContent = labelText;

        wrapper.append(label, control);
        return wrapper;
    }

    function makeButton(text, className = "") {
        const button = document.createElement("button");
        button.type = "submit";
        button.textContent = text;
        button.className = "user-management-button" +
            (className ? " " + className : "");
        return button;
    }

    const roles = [
        { value: "CASHIER", label: "Kasir" },
        { value: "MANAGER", label: "Manajer" },
        { value: "ADMIN", label: "Administrator" }
    ];

    function roleLabel(role) {
        const found = roles.find(item => item.value === role);
        return found ? found.label : role;
    }

    const createSection = document.createElement("section");
    createSection.className = "user-management-create";

    const createTitle = document.createElement("h4");
    createTitle.textContent = "Tambah pengguna";

    const createForm = document.createElement("form");
    createForm.className = "user-management-form";

    const newName = makeInput("text", "name", "Nama lengkap");
    newName.required = true;
    newName.maxLength = 100;
    newName.autocomplete = "name";

    const newEmail = makeInput("email", "email", "nama@email.com");
    newEmail.required = true;
    newEmail.autocomplete = "email";

    const newPassword = makeInput(
        "password", "password", "Minimal 8 karakter"
    );
    newPassword.required = true;
    newPassword.minLength = 8;
    newPassword.maxLength = 128;
    newPassword.autocomplete = "new-password";

    const newRole = makeSelect("role", roles, "CASHIER");

    const createButton = makeButton("Tambah pengguna");
    createForm.append(
        makeField("Nama", newName),
        makeField("Email", newEmail),
        makeField("Kata sandi awal", newPassword),
        makeField("Hak akses", newRole),
        createButton
    );

    createForm.addEventListener("submit", async event => {
        event.preventDefault();
        createButton.disabled = true;
        createButton.textContent = "Menyimpan...";

        try {
            const result = await apiFetch("/api/users", {
                method: "POST",
                body: JSON.stringify({
                    name: newName.value.trim(),
                    email: newEmail.value.trim(),
                    password: newPassword.value,
                    role: newRole.value
                })
            });

            createForm.reset();
            newRole.value = "CASHIER";
            showFeedback(
                result.message || "Pengguna berhasil ditambahkan.",
                "success"
            );
            await loadUsers();
        } catch (error) {
            showFeedback(error.message || "Gagal menambahkan pengguna.", "error");
        } finally {
            createButton.disabled = false;
            createButton.textContent = "Tambah pengguna";
        }
    });

    createSection.append(createTitle, createForm);

    const listSection = document.createElement("section");
    listSection.className = "user-management-list-section";

    const listTitle = document.createElement("h4");
    listTitle.textContent = "Daftar pengguna";

    const list = document.createElement("div");
    list.className = "user-management-list";

    listSection.append(listTitle, list);

    const authSection = document.createElement("section");
    authSection.className = "user-management-auth-setting";

    const authHeading = document.createElement("h4");
    authHeading.textContent = "Keamanan akses";

    const authDescription = document.createElement("p");
    authDescription.textContent =
        "Jika aktif, pengguna harus masuk dengan email dan kata sandi. Jika nonaktif, SmartPOS membuka sesi kasir otomatis.";

    const toggleRow = document.createElement("label");
    toggleRow.className = "user-management-auth-toggle";

    const toggleText = document.createElement("span");
    toggleText.textContent = "Wajib Login";

    const loginToggle = document.createElement("input");
    loginToggle.type = "checkbox";
    loginToggle.checked = true;
    loginToggle.disabled = true;
    loginToggle.setAttribute("aria-label", "Wajib Login");

    const toggleState = document.createElement("span");
    toggleState.className = "user-management-auth-state";
    toggleState.textContent = "Memuat pengaturan...";

    toggleRow.append(toggleText, loginToggle, toggleState);
    authSection.append(authHeading, authDescription, toggleRow);

    panel.append(intro, feedback, authSection);
    container.appendChild(panel);

    try {
        const settings = await fetchAuthSettings();
        loginToggle.checked = settings.requiredLogin;
        loginToggle.disabled = false;
        toggleState.textContent = settings.requiredLogin ? "Aktif" : "Nonaktif";
    } catch (error) {
        toggleState.textContent = "Tidak dapat dimuat";
        showFeedback(error.message, "error");
    }

    loginToggle.addEventListener("change", async () => {
        const requiredLogin = loginToggle.checked;
        loginToggle.disabled = true;
        toggleState.textContent = "Menyimpan...";

        try {
            if (isGuest) {
                if (!requiredLogin) {
                    throw new Error("Sesi kasir otomatis hanya dapat mengaktifkan login.");
                }

                await apiFetch("/api/auth/enable-login", {
                    method: "POST",
                    body: JSON.stringify({})
                });
            } else {
                await apiFetch("/api/auth/settings", {
                    method: "PATCH",
                    body: JSON.stringify({ requiredLogin })
                });
            }

            localStorage.removeItem("smartpos_token");
            localStorage.removeItem("smartpos_user");
            token = null;
            window.location.reload();
        } catch (error) {
            loginToggle.checked = !requiredLogin;
            loginToggle.disabled = false;
            toggleState.textContent = loginToggle.checked ? "Aktif" : "Nonaktif";
            showFeedback(error.message || "Pengaturan login gagal disimpan.", "error");
        }
    });

    if (isGuest) {
        introTitle.textContent = "Akses aplikasi";
        introText.textContent =
            "Mode kasir otomatis aktif. Aktifkan Wajib Login untuk kembali ke layar masuk.";
        return;
    }

    panel.append(createSection, listSection);

    async function loadUsers() {
        list.replaceChildren();

        const loading = document.createElement("p");
        loading.className = "user-management-empty";
        loading.textContent = "Memuat daftar pengguna...";
        list.appendChild(loading);

        try {
            const result = await apiFetch("/api/users");
            const users = Array.isArray(result.data) ? result.data : [];

            list.replaceChildren();

            if (users.length === 0) {
                const empty = document.createElement("p");
                empty.className = "user-management-empty";
                empty.textContent = "Belum ada pengguna.";
                list.appendChild(empty);
                return;
            }

            users.forEach(user => {
                const card = document.createElement("article");
                card.className = "user-management-card";

                const header = document.createElement("div");
                header.className = "user-management-card-header";

                const identity = document.createElement("div");
                identity.className = "user-management-identity";

                const nameHeading = document.createElement("strong");
                nameHeading.textContent = user.name || "Tanpa nama";

                const emailText = document.createElement("span");
                emailText.textContent = user.email || "";

                identity.append(nameHeading, emailText);

                const statusBadge = document.createElement("span");
                statusBadge.className = "user-management-status " +
                    (user.isActive ? "is-active" : "is-inactive");
                statusBadge.textContent = user.isActive ? "Aktif" : "Nonaktif";

                header.append(identity, statusBadge);

                const roleText = document.createElement("p");
                roleText.className = "user-management-role";
                roleText.textContent = "Hak akses saat ini: " +
                    roleLabel(user.role);

                const editForm = document.createElement("form");
                editForm.className = "user-management-edit-form";

                const nameInput = makeInput(
                    "text", "name", "Nama lengkap", user.name || ""
                );
                nameInput.required = true;
                nameInput.maxLength = 100;

                const emailInput = makeInput(
                    "email", "email", "Email", user.email || ""
                );
                emailInput.required = true;

                const roleSelect = makeSelect(
                    "role", roles, user.role || "CASHIER"
                );

                const statusSelect = makeSelect("isActive", [
                    { value: "true", label: "Aktif" },
                    { value: "false", label: "Nonaktif" }
                ], String(Boolean(user.isActive)));

                const passwordInput = makeInput(
                    "password", "password", "Kosongkan jika tidak diubah"
                );
                passwordInput.minLength = 8;
                passwordInput.maxLength = 128;
                passwordInput.autocomplete = "new-password";

                const isSelf = String(user.id) === String(currentUser?.id);

                if (isSelf) {
                    roleSelect.disabled = true;
                    statusSelect.disabled = true;
                }

                const saveButton = makeButton("Simpan perubahan");
                editForm.append(
                    makeField("Nama", nameInput),
                    makeField("Email", emailInput),
                    makeField("Hak akses", roleSelect),
                    makeField("Status akun", statusSelect),
                    makeField("Kata sandi baru (opsional)", passwordInput),
                    saveButton
                );

                editForm.addEventListener("submit", async event => {
                    event.preventDefault();

                    const payload = {};

                    if (nameInput.value.trim() !== (user.name || "")) {
                        payload.name = nameInput.value.trim();
                    }

                    if (emailInput.value.trim() !== (user.email || "")) {
                        payload.email = emailInput.value.trim();
                    }

                    if (!isSelf && roleSelect.value !== user.role) {
                        payload.role = roleSelect.value;
                    }

                    if (
                        !isSelf &&
                        (statusSelect.value === "true") !== Boolean(user.isActive)
                    ) {
                        payload.isActive = statusSelect.value === "true";
                    }

                    if (passwordInput.value) {
                        payload.password = passwordInput.value;
                    }

                    if (Object.keys(payload).length === 0) {
                        showFeedback(
                            "Belum ada perubahan yang perlu disimpan.",
                            "error"
                        );
                        return;
                    }

                    saveButton.disabled = true;
                    saveButton.textContent = "Menyimpan...";

                    try {
                        const updated = await apiFetch(
                            "/api/users/" + encodeURIComponent(user.id),
                            {
                                method: "PATCH",
                                body: JSON.stringify(payload)
                            }
                        );

                        showFeedback(
                            updated.message || "Pengguna berhasil diperbarui.",
                            "success"
                        );
                        await loadUsers();
                    } catch (error) {
                        showFeedback(
                            error.message || "Gagal memperbarui pengguna.",
                            "error"
                        );
                    } finally {
                        saveButton.disabled = false;
                        saveButton.textContent = "Simpan perubahan";
                    }
                });

                card.append(header, roleText, editForm);
                list.appendChild(card);
            });
        } catch (error) {
            list.replaceChildren();

            const message = document.createElement("p");
            message.className = "user-management-empty";
            message.textContent =
                error.message || "Gagal memuat daftar pengguna.";

            list.appendChild(message);
        }
    }

    void loadUsers();
}

   function setupSettingsNavigation() {
    const section = document.getElementById("settingsSection");

    if (!section || section.dataset.navigationReady === "true") {
        return;
    }

    const usersPageButton =
        section.querySelector('[data-settings-page="users"]');
    const storedUser = getStoredUser();

    // Penyaringan menu untuk kenyamanan UI; API tetap memvalidasi role ADMIN.
    if (usersPageButton) {
        usersPageButton.hidden =
            String(storedUser?.role || "").toUpperCase() !== "ADMIN" &&
            storedUser?.isGuest !== true;
    }

    const home = document.getElementById("settingsHome");
    const detail = document.getElementById("settingsDetail");
    const backButton = document.getElementById("settingsBackBtn");
    const detailIcon = document.getElementById("settingsDetailIcon");
    const detailTitle = document.getElementById("settingsDetailTitle");
    const detailDescription = document.getElementById("settingsDetailDescription");
    const detailContent = document.getElementById("settingsDetailContent");

    if (!home || !detail || !backButton || !detailContent) {
        console.error("Elemen navigasi Settings belum lengkap.");
        return;
    }

    const pages = {
        store: {
            icon: "🏪",
            title: "Profil Toko",
            description: "Informasi identitas dan kontak toko."
        },
        appearance: {
            icon: "🎨",
            title: "Tampilan Aplikasi",
            description: "Atur tema terang atau gelap SmartPOS."
        },
        appIdentity: {
            icon: "🖼️",
            title: "Identitas Aplikasi",
            description: "Atur logo utama SmartPOS."
        },
        backup: {
            icon: "💾",
            title: "Backup & Pemulihan Data",
            description: "Kelola pencadangan dan pemulihan data."
        },
        receipt: {
            icon: "🧾",
            title: "Pengaturan Struk",
            description: "Atur informasi dan format struk transaksi."
        },
        users: {
            icon: "👥",
            title: "Pengguna & Hak Akses",
            description: "Kelola pengguna dan izin akses."
        },
        tax: {
            icon: "％",
            title: "Pajak & Diskon",
            description: "Atur kebijakan pajak dan diskon penjualan."
        },
        payment: {
            icon: "💳",
            title: "Pengaturan Pembayaran",
            description: "Atur metode pembayaran tunai dan QRIS."
        }
    };

    function showSettingsHome() {
        detail.hidden = true;
        home.hidden = false;
    }



function logoImageUrl(logoUrl) {
    if (!logoUrl) return "";
    if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
    return API_URL + (logoUrl.startsWith("/") ? logoUrl : "/" + logoUrl);
}

async function uploadLogoFile(endpoint, file) {
    const token = localStorage.getItem("smartpos_token");
    const headers = { "Content-Type": file.type };
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(API_URL + endpoint, { method: "POST", headers, body: file });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.message || "Upload logo gagal.");
    return result;
}

async function deleteLogoFile(endpoint) {
    const result = await apiFetch(endpoint, { method: "DELETE" });
    if (!result || result.success !== true) throw new Error((result && result.message) || "Penghapusan logo gagal.");
    return result;
}


async function applyAppIdentity() {
    try {
        const result = await apiFetch("/api/branding/identity");
        if (!result || result.success !== true || !result.data) {
            throw new Error("Identitas aplikasi gagal dimuat.");
        }

        const appName = result.data.appName || "SmartPOS";
        const appSubtitle = result.data.appSubtitle || "Point of Sale";
        const brandName = document.getElementById("smartposAppName");
        const brandSubtitle = document.getElementById("smartposAppSubtitle");

        if (brandName) brandName.textContent = appName;
        if (brandSubtitle) brandSubtitle.textContent = appSubtitle;
        document.title = appName;

        // Ambil logo yang tersimpan di backend, termasuk setelah browser refresh.
        const logoResult = await apiFetch("/api/branding/");
        if (!logoResult || logoResult.success !== true) {
            throw new Error("Logo aplikasi gagal dimuat.");
        }

        const logoUrl = logoResult.data && logoResult.data.logoUrl;
        const sidebar = document.getElementById("smartposAppLogo");
        if (sidebar) {
            sidebar.replaceChildren();
            if (logoUrl) {
                const img = document.createElement("img");
                img.alt = "Logo aplikasi";
                img.src = logoImageUrl(logoUrl);
                sidebar.appendChild(img);
            } else {
                sidebar.textContent = appName.trim().charAt(0).toUpperCase() || "S";
            }
        }
    } catch (error) {
        console.error("LOAD APP IDENTITY:", error);
    }
}
async function renderAppIdentitySettings() {
    const appNameInput = document.getElementById("appIdentityName");
    const subtitleInput = document.getElementById("appIdentitySubtitle");
    const form = document.getElementById("appIdentityForm");
    const feedback = document.getElementById("appIdentityFeedback");
    const fileInput = document.getElementById("appLogoFile");
    const logoFeedback = document.getElementById("appLogoFeedback");
    const preview = document.getElementById("appLogoPreviewFrame");
    const resetLogoButton = document.getElementById("resetAppLogoBtn");
    const resetNameButton = document.getElementById("resetAppNameBtn");
    const resetSubtitleButton = document.getElementById("resetAppSubtitleBtn");

    if (!appNameInput || !subtitleInput || !form || !feedback ||
        !fileInput || !logoFeedback || !preview || !resetLogoButton ||
        !resetNameButton || !resetSubtitleButton) return;

    function showFeedback(message, type) {
        feedback.textContent = message;
        feedback.className = "app-identity-feedback" + (type ? " is-" + type : "");
    }

    async function refreshLogo() {
        try {
            const result = await apiFetch("/api/branding/");
            if (!result || result.success !== true) throw new Error("Logo gagal dimuat.");

            const url = result.data && result.data.logoUrl;
            preview.replaceChildren();

            if (url) {
                const img = document.createElement("img");
                img.alt = "Logo aplikasi";
                img.src = logoImageUrl(url);
                preview.appendChild(img);
            } else {
                preview.textContent = (appNameInput.value.trim() || "SmartPOS").charAt(0).toUpperCase();
            }

            const sidebar = document.getElementById("smartposAppLogo");
            if (sidebar) {
                sidebar.replaceChildren();
                if (url) {
                    const img = document.createElement("img");
                    img.alt = "Logo aplikasi";
                    img.src = logoImageUrl(url);
                    sidebar.appendChild(img);
                } else {
                    sidebar.textContent = (document.getElementById("smartposAppName")?.textContent || "SmartPOS").trim().charAt(0).toUpperCase();
                }
            }
        } catch (error) {
            logoFeedback.textContent = error.message || "Logo gagal dimuat.";
        }
    }

    async function saveIdentity(appName, appSubtitle) {
        const result = await apiFetch("/api/branding/identity", {
            method: "PUT",
            body: JSON.stringify({ appName, appSubtitle })
        });
        if (!result || result.success !== true || !result.data) {
            throw new Error((result && result.message) || "Penyimpanan gagal.");
        }
        appNameInput.value = result.data.appName;
        subtitleInput.value = result.data.appSubtitle;
        await applyAppIdentity();
    }

    try {
        const result = await apiFetch("/api/branding/identity");
        if (!result || result.success !== true || !result.data) {
            throw new Error("Identitas aplikasi gagal dimuat.");
        }
        appNameInput.value = result.data.appName || "SmartPOS";
        subtitleInput.value = result.data.appSubtitle || "Point of Sale";
    } catch (error) {
        showFeedback(error.message || "Identitas aplikasi gagal dimuat.", "error");
    }

    await refreshLogo();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const appName = appNameInput.value.trim();
        const appSubtitle = subtitleInput.value.trim();

        if (!appName || !appSubtitle) {
            showFeedback("Nama aplikasi dan subtitle wajib diisi.", "error");
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Menyimpan...";
        }
        showFeedback("Menyimpan perubahan...", "");

        try {
            await saveIdentity(appName, appSubtitle);
            showFeedback("Perubahan berhasil disimpan.", "success");
        } catch (error) {
            showFeedback(error.message || "Gagal menyimpan perubahan.", "error");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Simpan Perubahan";
            }
        }
    });

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            logoFeedback.textContent = "Ukuran logo maksimal 2 MB.";
            fileInput.value = "";
            return;
        }

        logoFeedback.textContent = "Mengunggah logo...";
        try {
            await uploadLogoFile("/api/branding/logo", file);
            await refreshLogo();
            logoFeedback.textContent = "Logo berhasil disimpan.";
        } catch (error) {
            logoFeedback.textContent = error.message || "Upload gagal.";
        } finally {
            fileInput.value = "";
        }
    });

    resetLogoButton.addEventListener("click", async () => {
        const confirmed = await showConfirmDialog({
            title: "Reset Logo Aplikasi?",
            message: "Logo akan dikembalikan ke huruf awal nama aplikasi.",
            confirmText: "Ya, Reset Logo",
            cancelText: "Batal",
            danger: true
        });
        if (!confirmed) return;

        logoFeedback.textContent = "Mereset logo...";
        try {
            await deleteLogoFile("/api/branding/logo");
            await refreshLogo();
            logoFeedback.textContent = "Logo berhasil direset.";
        } catch (error) {
            logoFeedback.textContent = error.message || "Reset logo gagal.";
        }
    });

    resetNameButton.addEventListener("click", async () => {
        const confirmed = await showConfirmDialog({
            title: "Reset Nama Aplikasi?",
            message: "Nama aplikasi akan dikembalikan menjadi SmartPOS.",
            confirmText: "Ya, Reset Nama",
            cancelText: "Batal"
        });
        if (!confirmed) return;

        try {
            await saveIdentity("SmartPOS", subtitleInput.value.trim() || "Point of Sale");
            showFeedback("Nama aplikasi berhasil direset.", "success");
            await refreshLogo();
        } catch (error) {
            showFeedback(error.message || "Reset nama gagal.", "error");
        }
    });

    resetSubtitleButton.addEventListener("click", async () => {
        const confirmed = await showConfirmDialog({
            title: "Reset Subtitle?",
            message: "Subtitle akan dikembalikan menjadi Point of Sale.",
            confirmText: "Ya, Reset Subtitle",
            cancelText: "Batal"
        });
        if (!confirmed) return;

        try {
            await saveIdentity(appNameInput.value.trim() || "SmartPOS", "Point of Sale");
            showFeedback("Subtitle berhasil direset.", "success");
        } catch (error) {
            showFeedback(error.message || "Reset subtitle gagal.", "error");
        }
    });
}
function setupLogoUploader() {
    const input = document.getElementById("storeLogoFile");
    const preview = document.getElementById("storeLogoPreview");
    const placeholder = document.getElementById("storeLogoPlaceholder");
    const feedback = document.getElementById("storeLogoFeedback");
    const deleteButton = document.getElementById("deleteStoreLogoBtn");
    if (!input || !preview || !placeholder || !feedback || !deleteButton) return;
    const endpoint = "/api/stores/" + encodeURIComponent(STORE_ID) + "/logo";
    async function refresh() {
        try {
            const result = await apiFetch(endpoint);
            const url = result && result.data && result.data.logoUrl;
            preview.hidden = !url;
            if (url) preview.src = logoImageUrl(url); else preview.removeAttribute("src");
            placeholder.hidden = !!url;
        } catch (error) { feedback.textContent = error.message || "Logo toko gagal dimuat."; }
    }
    input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { feedback.textContent = "Ukuran logo maksimal 2 MB."; input.value = ""; return; }
        feedback.textContent = "Mengunggah logo toko...";
        try { await uploadLogoFile(endpoint, file); await refresh(); feedback.textContent = "Logo toko berhasil diperbarui."; }
        catch (error) { feedback.textContent = error.message || "Upload logo gagal."; }
        finally { input.value = ""; }
    });
    deleteButton.addEventListener("click", async () => {
        if (!confirm("Hapus logo toko?")) return;
        try { await deleteLogoFile(endpoint); await refresh(); feedback.textContent = "Logo toko dihapus."; }
        catch (error) { feedback.textContent = error.message || "Hapus logo gagal."; }
    });
    refresh();
}


async function renderStoreProfile() {
    const container = document.getElementById("settingsDetailContent");
    if (!container) return;

    container.innerHTML = `
        <div class="store-profile-panel app-branding-panel">
            <section class="logo-settings-card app-branding-card">
                <div class="logo-settings-heading">
                    <span class="app-branding-eyebrow">IDENTITAS APLIKASI</span>
                    <h3>Logo SmartPOS</h3>
                    <p>Logo ini tampil pada sidebar aplikasi.</p>
                </div>

                <div class="logo-settings-controls">
                    <div class="logo-preview-frame" id="appLogoPreviewFrame" aria-label="Pratinjau logo">S</div>
                    <div class="logo-settings-actions">
                        <label class="primary-btn logo-upload-button" for="appLogoFile">Pilih Logo</label>
                        <input id="appLogoFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                        <button type="button" id="resetAppLogoBtn" class="secondary-btn">Reset Logo</button>
                        <p class="logo-settings-hint">PNG, JPG, atau WebP · Maksimal 2 MB</p>
                        <div id="appLogoFeedback" role="status" aria-live="polite"></div>
                    </div>
                </div>
            </section>

            <section class="logo-settings-card app-identity-card">
                <div class="logo-settings-heading">
                    <span class="app-branding-eyebrow">PENGATURAN TAMPILAN</span>
                    <h3>Nama Aplikasi</h3>
                    <p>Atur nama dan subtitle yang terlihat pada sidebar serta tab browser.</p>
                </div>

                <form id="appIdentityForm" class="app-identity-form">
                    <div class="app-identity-field">
                        <label for="appIdentityName">Nama Aplikasi</label>
                        <input id="appIdentityName" name="appName" type="text" maxlength="40"
                            placeholder="Contoh: SmartPOS" autocomplete="off" required>
                        <div class="app-identity-reset-row">
                            <small>Maksimal 40 karakter.</small>
                            <button type="button" id="resetAppNameBtn" class="secondary-btn app-identity-reset-btn">Reset Nama</button>
                        </div>
                    </div>

                    <div class="app-identity-field">
                        <label for="appIdentitySubtitle">Subtitle</label>
                        <input id="appIdentitySubtitle" name="appSubtitle" type="text" maxlength="60"
                            placeholder="Contoh: Point of Sale" autocomplete="off" required>
                        <div class="app-identity-reset-row">
                            <small>Maksimal 60 karakter.</small>
                            <button type="button" id="resetAppSubtitleBtn" class="secondary-btn app-identity-reset-btn">Reset Subtitle</button>
                        </div>
                    </div>

                    <div class="app-identity-footer">
                        <div id="appIdentityFeedback" class="app-identity-feedback"
                            role="status" aria-live="polite"></div>
                        <button type="submit" class="primary-btn">Simpan Perubahan</button>
                    </div>
                </form>
            </section>
        </div>
    `;

    await renderAppIdentitySettings();
}


async function renderBackupSettings() {
    const container = document.getElementById("settingsDetailContent");
    if (!container) return;

    container.innerHTML = `
        <section class="backup-settings-panel">

            <div class="backup-settings-format backup-settings-format-card">
                <div class="backup-settings-format-row">
                    <div class="backup-settings-format-copy">
                        <label for="backupFormatSelect">Format cadangan</label>
                        <p>Pilih jenis file untuk menyimpan salinan data SmartPOS.</p>
                    </div>
                    <select id="backupFormatSelect">
                        <option value="json">JSON — data database</option>
                        <option value="zip">ZIP — paket database</option>
                    </select>
                </div>
                <p id="backupFormatDescription" class="backup-settings-format-description">
                    JSON berisi data database dalam satu file.
                </p>
                <p class="backup-settings-format-hint">
                    ZIP berisi database.json dan manifest.json. Laporan Excel tidak disertakan.
                    Simpan file cadangan di lokasi yang aman.
                </p>
            </div>

            <div class="backup-settings-actions">
                <button type="button" class="primary-btn" id="createBackupBtn">
                    Buat Cadangan
                </button>
                <button type="button" class="secondary-btn" id="downloadBackupBtn" hidden>
                    Unduh Cadangan
                </button>
            </div>

            <div class="backup-settings-feedback" id="backupSettingsFeedback"
                 role="status" aria-live="polite"></div>

            <div class="backup-settings-result" id="backupSettingsResult" hidden>
                <h4 id="backupResultTitle">Cadangan berhasil dibuat</h4>
                <dl>
                    <div><dt>Format</dt><dd id="backupResultFormat"></dd></div>
                    <div><dt>Nama file</dt><dd id="backupResultFilename"></dd></div>
                    <div><dt>Waktu dibuat</dt><dd id="backupResultDate"></dd></div>
                    <div><dt>Total record</dt><dd id="backupResultRecords"></dd></div>
                    <div><dt>Ukuran file</dt><dd id="backupResultSize"></dd></div>
                </dl>
            </div>


            <div class="backup-settings-restore-card backup-settings-restore-combined">
                <div class="backup-settings-restore-heading">
                    <h4>Pemulihan Database</h4>
                    <p>Pilih file ZIP dan periksa kelengkapannya sebelum memulihkan data.</p>
                </div>

                <div class="backup-settings-file-row">
                    <label class="backup-settings-file-label" for="backupZipFile">File cadangan ZIP</label>
                    <input id="backupZipFile" type="file" accept=".zip,application/zip,application/octet-stream">
                </div>

                <div class="backup-settings-actions">
                    <button type="button" class="secondary-btn" id="validateBackupZipBtn">Validasi &amp; Pratinjau</button>
                </div>

                <p id="backupZipFeedback" class="backup-settings-feedback" role="status" aria-live="polite"></p>

                <div id="backupZipPreview" class="backup-settings-zip-preview" hidden>
                    <h4>Hasil pemeriksaan cadangan</h4>
                    <dl>
                        <div><dt>Nama file</dt><dd id="backupZipPreviewFilename"></dd></div>
                        <div><dt>Tanggal cadangan</dt><dd id="backupZipPreviewDate"></dd></div>
                        <div><dt>Jumlah model</dt><dd id="backupZipPreviewModels"></dd></div>
                        <div><dt>Total record</dt><dd id="backupZipPreviewRecords"></dd></div>
                    </dl>
                    <h5>Rincian record per model</h5>
                    <ul id="backupZipPreviewCounts" class="backup-settings-model-counts"></ul>
                    <p class="backup-settings-zip-warning">Pratinjau saja. Belum ada data yang dipulihkan atau diubah.</p>
                </div>

                <div class="backup-settings-restore-divider"></div>

                <div class="backup-settings-restore-warning">
                    <strong>Sebelum memulihkan</strong>
                    <p>Pemulihan akan mengganti data saat ini dengan isi ZIP yang dipilih. Pastikan file dan tanggalnya benar. Sistem harus membuat cadangan pengaman terlebih dahulu.</p>
                </div>

                <div class="backup-settings-actions backup-settings-restore-final-action">
                    <button type="button" class="primary-btn" id="restoreBackupZipBtn" disabled>Pulihkan dari ZIP</button>
                </div>
            </div>

            <div class="backup-settings-restore-card backup-settings-reset-card">
                <div class="backup-settings-reset-heading">
                    <div class="backup-settings-reset-icon" aria-hidden="true">
                        <i class="fas fa-rotate-left"></i>
                    </div>
                    <div>
                        <h4>Reset Data Operasional</h4>
                        <p>Mulai kembali pencatatan operasional toko dengan membersihkan
                        transaksi dan catatan aktivitas yang terkait.</p>
                    </div>
                </div>

                <div class="backup-settings-reset-preserved">
                    <i class="fas fa-shield-alt" aria-hidden="true"></i>
                    <div>
                        <strong>Data master tetap aman</strong>
                        <p>Akun, toko, produk dan stok, pelanggan, pemasok, serta promosi
                        akan dipertahankan.</p>
                    </div>
                </div>

                <div class="backup-settings-reset-warning">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    <p><strong>Perhatian:</strong> data operasional yang dihapus hanya dapat
                    dipulihkan dari cadangan. Sistem akan membuat cadangan pengaman
                    terlebih dahulu sebelum reset dijalankan.</p>
                </div>

                <div class="backup-settings-actions backup-settings-reset-actions">
                    <button type="button" class="secondary-btn" id="resetOperationalDataBtn">
                        <i class="fas fa-trash-alt" aria-hidden="true"></i>
                        Reset Data Operasional
                    </button>
                </div>
            </div>

            <div id="resetOperationalModal" class="reset-operational-modal" hidden>
                <section class="reset-operational-dialog" role="dialog"
                    aria-modal="true" aria-labelledby="resetOperationalModalTitle"
                    aria-describedby="resetOperationalModalDescription">
                    <div class="reset-operational-dialog-icon" aria-hidden="true">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <h3 id="resetOperationalModalTitle">Konfirmasi Reset Data</h3>
                    <p id="resetOperationalModalDescription">
                        Reset akan menghapus transaksi dan catatan operasional.
                        Akun, toko, produk, stok, pelanggan, pemasok, dan promosi tetap dipertahankan.
                        Sistem akan membuat cadangan pengaman sebelum reset.
                    </p>
                    <form id="resetOperationalModalForm">
                        <label for="resetOperationalConfirmation">
                            Ketik <strong>RESET DATA OPERASIONAL</strong> untuk melanjutkan
                        </label>
                        <input id="resetOperationalConfirmation" type="text"
                            autocomplete="off" spellcheck="false"
                            placeholder="RESET DATA OPERASIONAL" required>
                        <div class="reset-operational-dialog-actions">
                            <button type="button" class="secondary-btn"
                                id="cancelResetOperationalBtn">Batal</button>
                            <button type="submit" class="primary-btn"
                                id="confirmResetOperationalBtn">Konfirmasi Reset</button>
                        </div>
                    </form>
                </section>
            </div>

            <p id="backupRestoreActionFeedback"
               class="backup-settings-feedback"
               role="status"
               aria-live="polite"></p>
        </section>
    `;

    const formatSelect = document.getElementById("backupFormatSelect");
    const formatDescription = document.getElementById("backupFormatDescription");
    const createButton = document.getElementById("createBackupBtn");
    const downloadButton = document.getElementById("downloadBackupBtn");
    const feedback = document.getElementById("backupSettingsFeedback");
    const resultPanel = document.getElementById("backupSettingsResult");

    let currentBackup = null;

    function setFeedback(message, type = "") {
        feedback.textContent = message;
        feedback.className = "backup-settings-feedback" +
            (type ? " is-" + type : "");
    }

    function formatBytes(bytes) {
        const value = Number(bytes);
        if (!Number.isFinite(value) || value < 0) return "Tidak diketahui";
        if (value < 1024) return value + " byte";
        if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
        return (value / (1024 * 1024)).toFixed(2) + " MB";
    }

    formatSelect.addEventListener("change", () => {
        formatDescription.textContent = formatSelect.value === "zip"
            ? "ZIP berisi database.json dan manifest.json."
            : "JSON berisi data database dalam satu file.";
        currentBackup = null;
        downloadButton.hidden = true;
        resultPanel.hidden = true;
        setFeedback("");
    });

    createButton.addEventListener("click", async () => {
        const format = formatSelect.value;
        const isZip = format === "zip";

        createButton.disabled = true;
        downloadButton.hidden = true;
        resultPanel.hidden = true;
        currentBackup = null;
        setFeedback("Sedang membuat cadangan " + format.toUpperCase() + "...");

        try {
            const response = await apiFetch(
                isZip ? "/api/backup/package" : "/api/backup",
                { method: "POST" }
            );

            const data = response && response.data;
            if (!response || !response.success || !data || !data.filename) {
                throw new Error(
                    "Server tidak mengembalikan informasi file cadangan."
                );
            }

            currentBackup = {
                filename: data.filename,
                format,
                downloadPath: isZip
                    ? "/api/backup/package/" +
                        encodeURIComponent(data.filename) + "/download"
                    : "/api/backup/" +
                        encodeURIComponent(data.filename) + "/download"
            };

            document.getElementById("backupResultTitle").textContent =
                "Cadangan berhasil dibuat";
            document.getElementById("backupResultFormat").textContent =
                format.toUpperCase();
            document.getElementById("backupResultFilename").textContent =
                data.filename;
            document.getElementById("backupResultDate").textContent =
                data.createdAt
                    ? new Date(data.createdAt).toLocaleString("id-ID")
                    : "-";
            document.getElementById("backupResultRecords").textContent =
                Number(data.totalRecords || 0).toLocaleString("id-ID");
            document.getElementById("backupResultSize").textContent =
                formatBytes(data.sizeBytes);

            resultPanel.hidden = false;
            downloadButton.hidden = false;
            setFeedback(
                response.message || "Cadangan berhasil dibuat.",
                "success"
            );
        } catch (error) {
            console.error("CREATE BACKUP ERROR:", error);
            setFeedback(
                error.message || "Gagal membuat cadangan. Periksa koneksi dan hak akses.",
                "error"
            );
        } finally {
            createButton.disabled = false;
        }
    });

    downloadButton.addEventListener("click", async () => {
        if (!currentBackup) {
            setFeedback("Buat cadangan terlebih dahulu.", "error");
            return;
        }

        downloadButton.disabled = true;
        setFeedback("Sedang menyiapkan file untuk diunduh...");

        try {
            const latestToken = localStorage.getItem("smartpos_token");
            const headers = {};
            if (latestToken) {
                headers.Authorization = "Bearer " + latestToken;
            }

            const response = await fetch(API_URL + currentBackup.downloadPath, {
                headers
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(
                    errorBody.message || "File cadangan gagal diunduh."
                );
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = currentBackup.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            setFeedback(
                "Unduhan dimulai. Pastikan file tersimpan dengan benar.",
                "success"
            );
        } catch (error) {
            console.error("DOWNLOAD BACKUP ERROR:", error);
            setFeedback(
                error.message || "Gagal mengunduh file cadangan.",
                "error"
            );
        } finally {
            downloadButton.disabled = false;
        }
    });

    // Validasi ZIP hanya membaca file dan tidak mengubah database.
    const zipInput = document.getElementById("backupZipFile");
    const validateZipButton = document.getElementById("validateBackupZipBtn");
    const zipFeedback = document.getElementById("backupZipFeedback");
    const zipPreview = document.getElementById("backupZipPreview");
    const restoreZipButton = document.getElementById("restoreBackupZipBtn");
    const resetOperationalButton = document.getElementById("resetOperationalDataBtn");
    const restoreActionFeedback = document.getElementById("backupRestoreActionFeedback");
    let validatedZipFile = null;
    let restoreOrResetInProgress = false;

    function setRestoreActionFeedback(message, type = "") {
        restoreActionFeedback.textContent = message;
        restoreActionFeedback.className = "backup-settings-feedback" +
            (type ? " is-" + type : "");
    }

    function setRestoreResetBusy(busy) {
        restoreOrResetInProgress = busy;
        restoreZipButton.disabled = busy || validatedZipFile !== zipInput.files?.[0];
        resetOperationalButton.disabled = busy;
        validateZipButton.disabled = busy;
        zipInput.disabled = busy;
    }

    async function sendBackupAction(url, options) {
        const token = localStorage.getItem("smartpos_token");
        const headers = { ...(options.headers || {}) };

        if (token) {
            headers.Authorization = "Bearer " + token;
        }

        const response = await fetch(API_URL + url, {
            ...options,
            headers
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Permintaan gagal. Periksa hak akses dan log backend."
            );
        }

        return result;
    }

    function setZipFeedback(message, type = "") {
        zipFeedback.textContent = message;
        zipFeedback.className = "backup-settings-feedback" +
            (type ? " is-" + type : "");
    }

    function clearZipPreview() {
        zipPreview.hidden = true;
        document.getElementById("backupZipPreviewCounts").replaceChildren();
    }

    zipInput.addEventListener("change", () => {
        validatedZipFile = null;
        restoreZipButton.disabled = true;
        clearZipPreview();
        setZipFeedback("");
        setRestoreActionFeedback("");
    });

    validateZipButton.addEventListener("click", async () => {
        const file = zipInput.files && zipInput.files[0];

        validatedZipFile = null;
        restoreZipButton.disabled = true;
        clearZipPreview();

        if (!file) {
            setZipFeedback("Pilih file ZIP terlebih dahulu.", "error");
            return;
        }

        if (!/\.zip$/i.test(file.name)) {
            setZipFeedback("File harus berformat .zip.", "error");
            return;
        }

        if (file.size === 0) {
            setZipFeedback("File ZIP kosong.", "error");
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setZipFeedback("Ukuran ZIP maksimal 50 MB.", "error");
            return;
        }

        validateZipButton.disabled = true;
        setZipFeedback("Memeriksa ZIP. Database tidak akan diubah...");

        try {
            const latestToken = localStorage.getItem("smartpos_token");
            const headers = { "Content-Type": "application/zip" };

            if (latestToken) {
                headers.Authorization = "Bearer " + latestToken;
            }

            const response = await fetch(API_URL + "/api/backup/validate-package", {
                method: "POST",
                headers,
                body: file
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Validasi ZIP gagal.");
            }

            const data = result.data || {};

            document.getElementById("backupZipPreviewFilename").textContent =
                file.name;
            document.getElementById("backupZipPreviewDate").textContent =
                data.createdAt
                    ? new Date(data.createdAt).toLocaleString("id-ID")
                    : "Tidak tersedia";
            document.getElementById("backupZipPreviewModels").textContent =
                Number(data.modelCount || 0).toLocaleString("id-ID");
            document.getElementById("backupZipPreviewRecords").textContent =
                Number(data.totalRecords || 0).toLocaleString("id-ID");

            const list = document.getElementById("backupZipPreviewCounts");
            list.replaceChildren();

            Object.entries(data.counts || {})
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([model, count]) => {
                    const item = document.createElement("li");
                    const name = document.createElement("span");
                    const value = document.createElement("strong");

                    name.textContent = model;
                    value.textContent = Number(count).toLocaleString("id-ID");

                    item.append(name, value);
                    list.appendChild(item);
                });

            zipPreview.hidden = false;
            validatedZipFile = file;
            restoreZipButton.disabled = restoreOrResetInProgress;
            setZipFeedback(
                result.message || "ZIP valid dan siap ditinjau.",
                "success"
            );
        } catch (error) {
            console.error("VALIDATE BACKUP ZIP ERROR:", error);
            setZipFeedback(
                error.message || "Gagal memvalidasi ZIP.",
                "error"
            );
        } finally {
            validateZipButton.disabled = false;
        }
    });

    // Restore hanya boleh menggunakan file yang baru saja lolos validasi.
    restoreZipButton.addEventListener("click", async () => {
        const file = zipInput.files && zipInput.files[0];

        if (!file || !validatedZipFile || file !== validatedZipFile) {
            setRestoreActionFeedback(
                "Pilih dan validasi ulang file ZIP sebelum pemulihan.",
                "error"
            );
            restoreZipButton.disabled = true;
            return;
        }

        const confirmed = window.confirm(
            "PERINGATAN: Restore akan mengganti seluruh data database saat ini " +
            "dengan isi ZIP. Backend akan membuat cadangan pengaman terlebih dahulu. " +
            "Lanjutkan pemulihan?"
        );

        if (!confirmed) {
            setRestoreActionFeedback("Pemulihan dibatalkan. Tidak ada permintaan dikirim.");
            return;
        }

        setRestoreResetBusy(true);
        setRestoreActionFeedback("Sedang memvalidasi ulang ZIP dan memulihkan database...");

        try {
            const result = await sendBackupAction("/api/backup/restore-package", {
                method: "POST",
                headers: { "Content-Type": "application/zip" },
                body: file
            });

            const data = result.data || {};
            setRestoreActionFeedback(
                (result.message || "Pemulihan berhasil.") +
                (data.safetyBackupFilename
                    ? " Cadangan pengaman: " + data.safetyBackupFilename + "."
                    : "") +
                " Muat ulang halaman untuk menyegarkan data aplikasi.",
                "success"
            );
            validatedZipFile = null;
            restoreZipButton.disabled = true;
        } catch (error) {
            console.error("RESTORE BACKUP ERROR:", error);
            setRestoreActionFeedback(
                error.message || "Pemulihan gagal. Periksa log backend.",
                "error"
            );
        } finally {
            setRestoreResetBusy(false);
            restoreZipButton.disabled = true;
        }
    });

    // Modal konfirmasi reset: permintaan ke backend hanya dikirim setelah teks cocok.
    const resetModal = document.getElementById("resetOperationalModal");
    const resetModalForm = document.getElementById("resetOperationalModalForm");
    const resetConfirmationInput = document.getElementById("resetOperationalConfirmation");
    const cancelResetModalButton = document.getElementById("cancelResetOperationalBtn");
    const confirmResetModalButton = document.getElementById("confirmResetOperationalBtn");

    function closeResetModal() {
        if (!resetModal) return;
        resetModal.hidden = true;
        document.body.classList.remove("reset-operational-modal-open");
        resetOperationalButton.focus();
        if (resetConfirmationInput) resetConfirmationInput.value = "";
    }

    resetOperationalButton.addEventListener("click", () => {
        if (!resetModal) {
            setRestoreActionFeedback("Formulir konfirmasi reset tidak ditemukan.", "error");
            return;
        }
        resetModal.hidden = false;
        document.body.classList.add("reset-operational-modal-open");
        resetConfirmationInput.value = "";
        window.setTimeout(() => resetConfirmationInput.focus(), 50);
    });

    cancelResetModalButton.addEventListener("click", closeResetModal);

    resetModal.addEventListener("click", (event) => {
        if (event.target === resetModal) closeResetModal();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && resetModal && !resetModal.hidden) {
            closeResetModal();
        }
    });

    resetModalForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const confirmation = resetConfirmationInput.value.trim();

        if (confirmation !== "RESET DATA OPERASIONAL") {
            setRestoreActionFeedback(
                "Reset dibatalkan: teks konfirmasi tidak cocok.",
                "error"
            );
            resetConfirmationInput.focus();
            return;
        }

        closeResetModal();
        setRestoreResetBusy(true);
        setRestoreActionFeedback("Sedang membuat cadangan pengaman dan mereset data...");

        try {
            const result = await sendBackupAction("/api/backup/reset-operational", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmation })
            });

            const data = result.data || {};
            setRestoreActionFeedback(
                (result.message || "Reset berhasil.") +
                " Total record dihapus: " +
                Number(data.totalDeleted || 0).toLocaleString("id-ID") +
                (data.safetyBackupFilename
                    ? ". Cadangan pengaman: " + data.safetyBackupFilename
                    : "") +
                ". Muat ulang halaman untuk menyegarkan data aplikasi.",
                "success"
            );
        } catch (error) {
            console.error("RESET OPERATIONAL DATA ERROR:", error);
            setRestoreActionFeedback(
                error.message || "Reset gagal. Periksa log backend.",
                "error"
            );
        } finally {
            setRestoreResetBusy(false);
        }
    });

}

/* =========================================================
   PENGATURAN STRUK
   ========================================================= */

function getReceiptSettings() {
    const defaults = {
        paperSize: "58",
        showLogo: true,
        showAddress: true,
        showPhone: true,
        showCustomer: true,
        storeName: "",
        storeAddress: "",
        storePhone: "",
        footerMessage: "Terima kasih telah berbelanja."
    };

    try {
        const raw = localStorage.getItem(
            "smartpos_receipt_settings_" + STORE_ID
        );
        if (!raw) return { ...defaults };

        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
            return { ...defaults };
        }

        return {
            ...defaults,
            ...saved,
            paperSize: saved.paperSize === "80" ? "80" : "58",
            showLogo: saved.showLogo !== false,
            showAddress: saved.showAddress !== false,
            showPhone: saved.showPhone !== false,
            showCustomer: saved.showCustomer !== false,
            storeName: typeof saved.storeName === "string"
                ? saved.storeName.slice(0, 100) : "",
            storeAddress: typeof saved.storeAddress === "string"
                ? saved.storeAddress.slice(0, 200) : "",
            storePhone: typeof saved.storePhone === "string"
                ? saved.storePhone.slice(0, 30) : "",
            footerMessage: typeof saved.footerMessage === "string"
                ? saved.footerMessage.slice(0, 300)
                : defaults.footerMessage
        };
    } catch (error) {
        console.warn("Pengaturan struk tidak dapat dibaca:", error);
        return { ...defaults };
    }
}

window.getReceiptSettings = getReceiptSettings;

function saveReceiptSettings(settings) {
    try {
        localStorage.setItem(
            "smartpos_receipt_settings_" + STORE_ID,
            JSON.stringify(settings)
        );
        return true;
    } catch (error) {
        console.error("Pengaturan struk gagal disimpan:", error);
        showToast("Pengaturan struk gagal disimpan di browser.", "error");
        return false;
    }
}

function renderReceiptSettings() {
    const settings = getReceiptSettings();
    const panel = document.createElement("div");
    panel.className = "receipt-settings-panel";

    panel.innerHTML = `
        <div class="receipt-settings-intro">
            <span class="receipt-settings-eyebrow">PREFERENSI CETAK</span>
            <h3>Format dan informasi struk</h3>
            <p>Atur informasi yang ditampilkan pada struk transaksi dan cetak ulang.</p>
        </div>

        <div class="receipt-settings-grid">
            <section class="receipt-settings-card">
                <h4>Ukuran kertas</h4>
                <label class="receipt-settings-field" for="receiptPaperSize">
                    <span>Lebar kertas printer</span>
                    <select id="receiptPaperSize">
                        <option value="58">58 mm</option>
                        <option value="80">80 mm</option>
                    </select>
                </label>

                <h4>Identitas toko pada struk</h4>
                <label class="receipt-settings-field" for="receiptStoreName">
                    <span>Nama toko</span>
                    <input id="receiptStoreName" type="text" maxlength="100"
                        placeholder="Kosongkan untuk memakai profil toko">
                    <small>Maksimal 100 karakter.</small>
                </label>
                <label class="receipt-settings-field" for="receiptStoreAddress">
                    <span>Alamat / jalan</span>
                    <textarea id="receiptStoreAddress" rows="2" maxlength="200"
                        placeholder="Alamat toko pada struk"></textarea>
                    <small>Maksimal 200 karakter.</small>
                </label>
                <label class="receipt-settings-field" for="receiptStorePhone">
                    <span>Nomor HP toko</span>
                    <input id="receiptStorePhone" type="tel" maxlength="30"
                        placeholder="Contoh: 081234567890">
                    <small>Maksimal 30 karakter.</small>
                </label>

                <h4>Informasi yang ditampilkan</h4>
                <label class="receipt-settings-toggle">
                    <span><strong>Logo toko</strong><small>Tampilkan logo di bagian atas struk.</small></span>
                    <input id="receiptShowLogo" type="checkbox">
                </label>
                <label class="receipt-settings-toggle">
                    <span><strong>Alamat toko</strong><small>Tampilkan alamat dari profil toko.</small></span>
                    <input id="receiptShowAddress" type="checkbox">
                </label>
                <label class="receipt-settings-toggle">
                    <span><strong>Nomor telepon</strong><small>Tampilkan telepon dari profil toko.</small></span>
                    <input id="receiptShowPhone" type="checkbox">
                </label>
                <label class="receipt-settings-toggle">
                    <span><strong>Nama pelanggan</strong><small>Tampilkan nama pelanggan pada struk.</small></span>
                    <input id="receiptShowCustomer" type="checkbox">
                </label>

                <label class="receipt-settings-field" for="receiptFooterMessage">
                    <span>Pesan penutup struk</span>
                    <textarea id="receiptFooterMessage" rows="3" maxlength="300"
                        placeholder="Contoh: Terima kasih telah berbelanja."></textarea>
                    <small>Maksimal 300 karakter.</small>
                </label>

                <div class="receipt-settings-actions">
                    <button type="button" class="btn btn-primary" id="receiptSettingsSave">
                        Simpan Pengaturan
                    </button>
                    <button type="button" class="btn btn-secondary" id="receiptSettingsReset">
                        Kembalikan Default
                    </button>
                </div>
                <p id="receiptSettingsFeedback" class="receipt-settings-feedback" role="status"></p>
            </section>

            <section class="receipt-settings-card receipt-preview-card">
                <div class="receipt-preview-heading">
                    <div>
                        <h4>Pratinjau struk</h4>
                        <p>Contoh tampilan, bukan transaksi asli.</p>
                    </div>
                    <span id="receiptPreviewWidth" class="receipt-preview-width"></span>
                </div>
                <div class="receipt-preview-paper" id="receiptPreviewPaper">
                    <div class="receipt-preview-logo" id="receiptPreviewLogo">S</div>
                    <h5 id="receiptPreviewStore">Nama Toko</h5>
                    <p id="receiptPreviewAddress" class="receipt-preview-muted"></p>
                    <p id="receiptPreviewPhone" class="receipt-preview-muted"></p>
                    <div class="receipt-preview-customer" id="receiptPreviewCustomer">
                        <small>PELANGGAN</small>
                        <strong>Pelanggan Umum</strong>
                    </div>
                    <hr>
                    <div class="receipt-preview-row"><span>Contoh produk</span><span>Rp15.000</span></div>
                    <div class="receipt-preview-row"><span>Jumlah</span><span>Rp15.000</span></div>
                    <hr>
                    <div class="receipt-preview-total"><span>TOTAL</span><strong>Rp15.000</strong></div>
                    <div class="receipt-preview-footer" id="receiptPreviewFooter"></div>
                    <p class="receipt-preview-muted">Simpan struk sebagai bukti transaksi.</p>
                </div>
            </section>
        </div>
    `;

    const byId = id => panel.querySelector("#" + id);
    const paperSize = byId("receiptPaperSize");
    const showLogo = byId("receiptShowLogo");
    const showAddress = byId("receiptShowAddress");
    const showPhone = byId("receiptShowPhone");
    const showCustomer = byId("receiptShowCustomer");
    const storeName = byId("receiptStoreName");
    const storeAddress = byId("receiptStoreAddress");
    const storePhone = byId("receiptStorePhone");
    const footerMessage = byId("receiptFooterMessage");
    const feedback = byId("receiptSettingsFeedback");

    paperSize.value = settings.paperSize;
    showLogo.checked = settings.showLogo;
    showAddress.checked = settings.showAddress;
    showPhone.checked = settings.showPhone;
    showCustomer.checked = settings.showCustomer;
    storeName.value = settings.storeName;
    storeAddress.value = settings.storeAddress;
    storePhone.value = settings.storePhone;
    footerMessage.value = settings.footerMessage;

    function currentFormSettings() {
        return {
            paperSize: paperSize.value === "80" ? "80" : "58",
            showLogo: showLogo.checked,
            showAddress: showAddress.checked,
            showPhone: showPhone.checked,
            showCustomer: showCustomer.checked,
            storeName: storeName.value.trim().slice(0, 100),
            storeAddress: storeAddress.value.trim().slice(0, 200),
            storePhone: storePhone.value.trim().slice(0, 30),
            footerMessage: footerMessage.value.slice(0, 300)
        };
    }

    function updatePreview() {
        const value = currentFormSettings();
        const paper = byId("receiptPreviewPaper");

        byId("receiptPreviewWidth").textContent = value.paperSize + " mm";
        paper.classList.toggle("receipt-preview-paper-wide", value.paperSize === "80");
        byId("receiptPreviewLogo").hidden = !value.showLogo;
        byId("receiptPreviewAddress").hidden = !value.showAddress;
        byId("receiptPreviewPhone").hidden = !value.showPhone;
        byId("receiptPreviewCustomer").hidden = !value.showCustomer;
        byId("receiptPreviewStore").textContent =
            value.storeName || "Nama Toko";
        byId("receiptPreviewAddress").textContent =
            value.storeAddress || "Alamat mengikuti profil toko";
        byId("receiptPreviewPhone").textContent =
            value.storePhone || "Telepon mengikuti profil toko";
        byId("receiptPreviewAddress").hidden =
            !value.showAddress;
        byId("receiptPreviewPhone").hidden =
            !value.showPhone;
        byId("receiptPreviewFooter").textContent = value.footerMessage;
    }

    [
        paperSize, showLogo, showAddress, showPhone, showCustomer,
        storeName, storeAddress, storePhone, footerMessage
    ].forEach(input => input.addEventListener("input", updatePreview));

    byId("receiptSettingsSave").addEventListener("click", () => {
        if (saveReceiptSettings(currentFormSettings())) {
            feedback.textContent = "Pengaturan struk berhasil disimpan.";
            feedback.classList.add("is-success");
            showToast("Pengaturan struk berhasil disimpan.", "success");
        } else {
            feedback.textContent = "Pengaturan belum berhasil disimpan.";
            feedback.classList.remove("is-success");
        }
    });

    byId("receiptSettingsReset").addEventListener("click", () => {
        const defaults = {
            paperSize: "58",
            showLogo: true,
            showAddress: true,
            showPhone: true,
            showCustomer: true,
            storeName: "",
            storeAddress: "",
            storePhone: "",
            footerMessage: "Terima kasih telah berbelanja."
        };

        paperSize.value = defaults.paperSize;
        showLogo.checked = defaults.showLogo;
        showAddress.checked = defaults.showAddress;
        showPhone.checked = defaults.showPhone;
        showCustomer.checked = defaults.showCustomer;
        storeName.value = defaults.storeName;
        storeAddress.value = defaults.storeAddress;
        storePhone.value = defaults.storePhone;
        footerMessage.value = defaults.footerMessage;
        updatePreview();

        feedback.textContent = "Default diterapkan pada formulir. Tekan Simpan Pengaturan untuk menyimpannya.";
        feedback.classList.remove("is-success");
    });

    updatePreview();
    detailContent.appendChild(panel);
}


async function renderPaymentSettings(container) {
    const user = getStoredUser();
    const canManage = ["ADMIN", "MANAGER"].includes(user?.role);
    const panel = document.createElement("div");
    panel.className = "qris-settings-panel";

    panel.innerHTML = `
        <div class="qris-settings-card">
            <div class="qris-settings-heading">
                <span class="qris-settings-icon">▦</span>
                <div>
                    <h3>QRIS Toko</h3>
                    <p>Gambar QRIS yang ditampilkan ketika pelanggan memilih pembayaran QRIS di kasir.</p>
                </div>
            </div>

            <div id="qrisSettingsPreview" class="qris-settings-preview">
                <p>Memuat gambar QRIS...</p>
            </div>

            <div class="qris-settings-actions">
                <label class="qris-upload-label" for="qrisSettingsFile">
                    Pilih Gambar QRIS
                </label>
                <input
                    id="qrisSettingsFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    ${canManage ? "" : "disabled"}
                >
                <button
                    type="button"
                    id="deleteQrisSettingsBtn"
                    class="qris-delete-btn"
                    ${canManage ? "" : "disabled"}
                >Hapus Gambar</button>
            </div>

            <p class="qris-settings-hint">
                Format PNG, JPG, atau WebP. Ukuran maksimal 2 MB.
            </p>
            <p id="qrisSettingsFeedback" class="qris-settings-feedback" role="status"></p>
            ${canManage ? "" : `
                <p class="qris-settings-readonly">
                    Mode lihat saja. Login menggunakan akun ADMIN atau MANAGER
                    untuk mengganti atau menghapus gambar QRIS.
                </p>
            `}
        </div>
    `;

    container.appendChild(panel);

    const preview = panel.querySelector("#qrisSettingsPreview");
    const fileInput = panel.querySelector("#qrisSettingsFile");
    const deleteButton = panel.querySelector("#deleteQrisSettingsBtn");
    const feedback = panel.querySelector("#qrisSettingsFeedback");

    function showFeedback(message, type = "") {
        feedback.textContent = message;
        feedback.className =
            "qris-settings-feedback" + (type ? " is-" + type : "");
    }

    async function refreshQrisImage() {
        try {
            const response = await fetch(`${API_URL}/api/payment-settings/qris`);
            const result = await response.json();

            if (!response.ok || result.success !== true) {
                throw new Error(result.message || "Gambar QRIS gagal dimuat.");
            }

            const url = result.data?.qrisImageUrl;
            preview.replaceChildren();

            if (url) {
                const img = document.createElement("img");
                img.alt = "Pratinjau QRIS toko";
                img.src = logoImageUrl(url) + "?v=" + Date.now();
                preview.appendChild(img);
            } else {
                const empty = document.createElement("p");
                empty.textContent = "Belum ada gambar QRIS yang disimpan.";
                preview.appendChild(empty);
            }

            if (deleteButton) deleteButton.disabled = !canManage || !url;
        } catch (error) {
            preview.replaceChildren();
            const message = document.createElement("p");
            message.textContent = error.message || "Gambar QRIS gagal dimuat.";
            preview.appendChild(message);
        }
    }

    await refreshQrisImage();

    if (!canManage) return;

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            showFeedback("Pilih gambar PNG, JPG, atau WebP.", "error");
            fileInput.value = "";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showFeedback("Ukuran gambar maksimal 2 MB.", "error");
            fileInput.value = "";
            return;
        }

        fileInput.disabled = true;
        showFeedback("Menyimpan gambar QRIS...");

        try {
            const result = await uploadLogoFile("/api/payment-settings/qris", file);
            if (!result.data?.qrisImageUrl) {
                throw new Error("Server tidak mengembalikan lokasi gambar.");
            }
            await refreshQrisImage();
            showFeedback("Gambar QRIS berhasil disimpan.", "success");
        } catch (error) {
            showFeedback(error.message || "Gagal menyimpan gambar QRIS.", "error");
        } finally {
            fileInput.disabled = false;
            fileInput.value = "";
        }
    });

    deleteButton.addEventListener("click", async () => {
        const confirmed = await showConfirmDialog({
            title: "Hapus Gambar QRIS?",
            message: "Gambar QRIS toko akan dihapus dari POS.",
            confirmText: "Ya, Hapus",
            cancelText: "Batal",
            danger: true
        });

        if (!confirmed) return;

        deleteButton.disabled = true;
        showFeedback("Menghapus gambar QRIS...");

        try {
            await deleteLogoFile("/api/payment-settings/qris");
            await refreshQrisImage();
            showFeedback("Gambar QRIS berhasil dihapus.", "success");
        } catch (error) {
            showFeedback(error.message || "Gagal menghapus gambar QRIS.", "error");
        } finally {
            deleteButton.disabled = false;
        }
    });
}

function openSettingsPage(key) {
    const page = pages[key];
    if (!page) return;

    if (detailIcon) detailIcon.textContent = page.icon;
    if (detailTitle) detailTitle.textContent = page.title;
    if (detailDescription) detailDescription.textContent = page.description;

    // Setiap kategori harus memulai dari panel yang bersih.
    // Ini mencegah formulir Profil Toko tertinggal di kategori lain.
    detailContent.replaceChildren();

    if (key === "store") {
        void renderStoreProfile();
    } else if (key === "backup") {
        void renderBackupSettings();
    } else if (key === "receipt") {
        renderReceiptSettings();
    } else if (key === "users") {
        void renderUserManagementSettings(detailContent);
    } else if (key === "payment") {
        void renderPaymentSettings(detailContent);
    } else {
        const notice = document.createElement("div");
        notice.className = "settings-placeholder";

        if (key === "appearance") {
            notice.textContent =
                "Pengaturan tampilan khusus belum tersedia di panel ini.";
        } else {
            notice.textContent =
                "Pengaturan kategori ini belum diintegrasikan. Belum ada perubahan data yang dilakukan.";
        }

        detailContent.appendChild(notice);
    }

    home.hidden = true;
    detail.hidden = false;
}

    section.querySelectorAll("[data-settings-page]").forEach(button => {
        button.addEventListener("click", () => {
            openSettingsPage(button.dataset.settingsPage);
        });
    });

    backButton.addEventListener("click", showSettingsHome);

    // Setiap kali Settings dibuka kembali dari sidebar,
    // tampilkan daftar kategori terlebih dahulu.
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            if (item.dataset.section === "settings") {
                showSettingsHome();
            }
        });
    });


section.dataset.navigationReady = "true";
showSettingsHome();

// Muat nama aplikasi, subtitle, dan logo tersimpan saat startup.
applyAppIdentity();
}


/* =========================================================
                        PAGE HEADER
   ========================================================= */

function updatePageHeader(section) {
    const titles = {
        pos: ["Point of Sale", "Kelola transaksi dengan mudah"],
        dashboard: ["Dashboard", "Ringkasan performa toko"],
        inventory: ["Inventory", "Kelola stok produk"],
        transactions: ["Transactions", "Riwayat transaksi"],
        customers: ["Customers", "Kelola pelanggan"],
        expenses: ["Expenses", "Kelola dan pantau pengeluaran operasional toko."],
        analytics: ["Analytics", "Analisis performa penjualan"],
        prediction: ["Prediksi Penjualan", "Estimasi pendapatan dari riwayat penjualan"],
        settings: ["Settings", "Pengaturan toko dan aplikasi"],
        reports: ["Recap", "Ringkasan penjualan dan keuangan"]
    };

    const data = titles[section] || titles.dashboard;

    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");

    if (pageTitle) pageTitle.textContent = data[0];
    if (pageSubtitle) pageSubtitle.textContent = data[1];
}


   /* =========================================================
      TOAST
      ========================================================= */

   function showToast(
       message,
       type = "success"
   ) {

       let toast =
           document.getElementById(
               "smartposToast"
           );


       if (!toast) {

           toast =
               document.createElement(
                   "div"
               );


           toast.id =
               "smartposToast";


           Object.assign(
               toast.style,
               {

                   position:
                       "fixed",

                   right:
                       "20px",

                   bottom:
                       "20px",

                   zIndex:
                       "9999",

                   padding:
                       "12px 16px",

                   borderRadius:
                       "10px",

                   color:
                       "white",

                   fontSize:
                       "12px",

                   fontWeight:
                       "700",

                   boxShadow:
                       "0 10px 30px rgba(0,0,0,.15)",

                   transition:
                       "opacity .2s ease"

               }
           );


           document.body.appendChild(
               toast
           );

       }


       toast.style.background =
           type === "error"
               ? "#e5484d"
               : "#16a085";


       toast.textContent =
           message;


       toast.style.opacity =
           "1";


       clearTimeout(
           toast._timer
       );


       toast._timer =
           setTimeout(
               () => {

                   toast.style.opacity =
                       "0";

               },
               2500
           );

   }


   /* =========================================================
      POS EVENTS
      ========================================================= */

   function setupEvents() {

       /* =====================================================
          PRODUCT CLICK
          ===================================================== */

       const productGrid =
           document.getElementById(
               "productGrid"
           );


       productGrid?.addEventListener(
           "click",
           event => {

               const card =
                   event.target.closest(
                       ".product-card"
                   );


               if (!card) return;


               const productId =
                   card.dataset.productId;


               addToCart(
                   productId
               );

           }
       );


       /* =====================================================
          SEARCH PRODUCT
          ===================================================== */

       const searchProduct =
           document.getElementById(
               "searchProduct"
           );


       searchProduct?.addEventListener(
           "input",
           renderProducts
       );


       /* =====================================================
          CATEGORY PRODUCT
          ===================================================== */

       document
           .querySelectorAll(
               ".category-btn"
           )
           .forEach(
               button => {

                   button.addEventListener(
                       "click",
                       () => {

                           document
                               .querySelectorAll(
                                   ".category-btn"
                               )
                               .forEach(
                                   btn =>
                                       btn.classList.remove(
                                           "active"
                                       )
                               );


                           button.classList.add(
                               "active"
                           );


                           renderProducts();

                       }
                   );

               }
           );


       /* =====================================================
          CART BUTTONS
          ===================================================== */

       const cartItems =
           document.getElementById(
               "cartItems"
           );


       cartItems?.addEventListener(
           "click",
           event => {

               const button =
                   event.target.closest(
                       "button[data-action]"
                   );


               if (!button) return;


               const id =
                   button.dataset.id;


               if (
                   button.dataset.action ===
                   "increase"
               ) {

                   increaseCart(
                       id
                   );

               } else {

                   decreaseCart(
                       id
                   );

               }

           }
       );


       /* =====================================================
          CLEAR CART
          ===================================================== */

       const clearCartButton =
           document.getElementById(
               "clearCart"
           );


       clearCartButton?.addEventListener(
           "click",
           clearCart
       );

    /* =====================================================
    INPUT JUMLAH PRODUK DI KERANJANG
    ===================================================== */

    cartItems?.addEventListener("change", event => {
        const input = event.target.closest(
            ".cart-quantity-input"
        );

        if (!input) return;

        const productId = input.dataset.id;

        const item = cart.find(
            item => String(item.productId) === String(productId)
        );

        const product = products.find(
            product => String(product.id) === String(productId)
        );

        if (!item || !product) return;

        const stock = Number(product.stock) || 0;
        const requestedQuantity = Number(input.value);

        if (
            !Number.isInteger(requestedQuantity) ||
            requestedQuantity < 1
        ) {
            showToast("Jumlah minimal 1", "error");
            renderCart();
            return;
        }

        if (requestedQuantity > stock) {
            showToast(
                `Stok tersedia hanya ${stock}`,
                "error"
            );
            renderCart();
            return;
        }

        item.quantity = requestedQuantity;

        renderProducts();
        renderCart();
    });



        /* =====================================================
            PAYMENT METHOD
            ===================================================== */

        document
            .querySelectorAll(
                ".cart-payment-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            setPaymentMethod(
                                button.dataset.payment
                            );

                        }
                    );

                }
            );


        /* =====================================================
            CHECKOUT
            ===================================================== */

        const checkoutButton =
            document.getElementById(
                "checkoutBtn"
            );


        checkoutButton?.addEventListener(
            "click",
            checkout
        );


    /* ========================================
    FORMAT NAMA PELANGGAN
    ======================================== */

    function formatCustomerName(value) {
        return value
            .toLowerCase()
            .replace(/(^|\s)\S/g, huruf => huruf.toUpperCase());
    }

    const customerNameInput =
        document.getElementById("checkoutCustomerName");

    customerNameInput?.addEventListener("input", function () {
        const posisi = this.selectionStart;
        const namaFormat = formatCustomerName(this.value);

        if (this.value !== namaFormat) {
            this.value = namaFormat;
            this.setSelectionRange(posisi, posisi);
        }
    });


       /* =====================================================
          CLOSE PAYMENT
          ===================================================== */

       const closePayment =
           document.getElementById(
               "closePayment"
           );


        closePayment?.addEventListener("click", () => {
            closePaymentModal(true);
        });


       /* =====================================================
          NEW TRANSACTION
          ===================================================== */

       const newTransaction =
           document.getElementById(
               "newTransaction"
           );


       newTransaction?.addEventListener(
           "click",
           () => {

               document
                   .getElementById(
                       "successModal"
                   )
                   ?.classList.add(
                       "hidden"
                   );


               selectedPaymentMethod =
                   "CASH";


               setPaymentMethod(
                   "CASH"
               );


               renderCart();

           }
       );


       /* =====================================================
          ANALYTICS PERIOD
          ===================================================== */

       document
           .querySelectorAll(
               ".period-btn"
           )
           .forEach(
               button => {

                   button.addEventListener(
                       "click",
                       () => {

                           document
                               .querySelectorAll(
                                   ".period-btn"
                               )
                               .forEach(
                                   btn =>
                                       btn.classList.remove(
                                           "active"
                                       )
                               );


                           button.classList.add(
                               "active"
                           );


                           loadAnalytics(
                               Number(
                                   button.dataset.days
                               ) || 7
                           );

                       }
                   );

               }
           );

/* =====================================================
   ANALYTICS CHART TYPE SELECTORS — VISUAL PICKER
===================================================== */

[
    "revenueChartType",
    "profitChartType",
    "transactionsChartType",
    "topProductsChartType",
    "busyHoursChartType",
    "comparisonChartType",
    "profitableProductsChartType"
].forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select || select.dataset.chartListener === "true") return;

    select.dataset.chartListener = "true";

    const choices = [
        { value: "line", label: "Garis", icon: "↗" },
        { value: "area", label: "Area", icon: "◒" },
        { value: "doughnut", label: "Donat", icon: "◉" },
        { value: "bar", label: "Batang", icon: "▥" }
    ];

    const picker = document.createElement("div");
    picker.className = "analytics-chart-options";
    picker.setAttribute("role", "group");
    picker.setAttribute(
        "aria-label",
        select.getAttribute("aria-label") || "Pilih jenis grafik"
    );

    choices.forEach(choice => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "analytics-chart-option";
        button.dataset.chartChoice = choice.value;
        button.setAttribute("aria-pressed", String(select.value === choice.value));
        button.innerHTML =
            '<span class="analytics-chart-option-icon" aria-hidden="true">' +
            choice.icon +
            '</span><span class="analytics-chart-option-label">' +
            choice.label +
            '</span>';

        button.addEventListener("click", () => {
            if (select.value === choice.value) return;
            select.value = choice.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });

        picker.appendChild(button);
    });

    select.classList.add("analytics-chart-select-native");
    select.insertAdjacentElement("afterend", picker);

    const syncPicker = () => {
        picker.querySelectorAll("[data-chart-choice]").forEach(button => {
            const active = button.dataset.chartChoice === select.value;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    };

    select.addEventListener("change", syncPicker);

    select.addEventListener("change", () => {
        if (window.smartposAnalyticsData) {
            renderAnalyticsCharts(window.smartposAnalyticsData);
        }
    });

    syncPicker();
});


/* =====================================================
          CUSTOMER / MEMBER EVENTS
          ===================================================== */

       const memberSearch =
       document.getElementById(
           "memberSearch"
       );


   let memberSearchTimer = null;


   memberSearch?.addEventListener(
       "input",
       event => {

           const keyword =
               event.target.value.trim();


           clearTimeout(
               memberSearchTimer
           );


           memberSearchTimer =
               setTimeout(
                   () => {

                       searchMembers(
                           keyword
                       );

                   },
                   300
               );

       }
   );


   /* =====================================================
      WALK-IN CUSTOMER
      ===================================================== */

   const walkInCustomerButton =
       document.getElementById(
           "walkInCustomerBtn"
       );


   walkInCustomerButton?.addEventListener(
       "click",
       () => {

           clearSelectedCustomer();

       }
   );


   /* =====================================================
      REMOVE MEMBER
      ===================================================== */

   const removeMemberButton =
       document.getElementById(
           "removeMemberBtn"
       );


   removeMemberButton?.addEventListener(
       "click",
       () => {

           clearSelectedCustomer();

       }
   );


   /* =====================================================
      REDEEM POINTS TOGGLE
      ===================================================== */

const redeemPointsToggle =
    document.getElementById("redeemPointsToggle");

redeemPointsToggle?.addEventListener("change", event => {
    const wrapper = document.getElementById(
        "redeemPointsInputWrapper"
    );

    const input = document.getElementById(
        "redeemPointsInput"
    );

    const preview = document.getElementById(
        "pointsDiscountPreview"
    );

    if (event.target.checked) {
        wrapper?.classList.remove("hidden");

        // Nilai redeem hanya diproses saat toggle aktif
        updatePointsDiscountPreview();
    } else {
        wrapper?.classList.add("hidden");

        selectedPointsToRedeem = 0;

        if (input) {
            input.value = "";
        }

        if (preview) {
            preview.textContent = formatRupiah(0);
        }

        // Kembalikan total tanpa diskon poin
        updateSummary();
    }
});


   /* =====================================================
      REDEEM POINTS INPUT
      ===================================================== */

   const redeemPointsInput =
       document.getElementById(
           "redeemPointsInput"
       );


   redeemPointsInput?.addEventListener(
       "input",
       () => {

           updatePointsDiscountPreview();

       }
   );

       /* =====================================================
          ESCAPE KEY
          ===================================================== */

          document.addEventListener(
            "keydown",
            event => {
                if (event.key === "Escape") {
                    const paymentModal =
                        document.getElementById("paymentModal");

                    if (
                        paymentModal &&
                        !paymentModal.classList.contains("hidden")
                    ) {
                        closePaymentModal(true);
                    }

                    closeProductModal();
                    closeTransactionDetail();
                }
            }
        );
   }

   /* =========================================================
   CUSTOMER / MEMBER
   ========================================================= */

async function searchMembers(keyword = "") {

    const resultsContainer =
        document.getElementById(
            "memberSearchResults"
        );

    if (!resultsContainer) return;


    const search =
        keyword.trim();


    if (!search) {

        resultsContainer.innerHTML = "";

        resultsContainer.classList.add(
            "hidden"
        );

        return;
    }


    resultsContainer.classList.remove(
        "hidden"
    );

    resultsContainer.innerHTML = `
        <div class="member-result">
            <span>🔄</span>
            <div class="member-result-info">
                <span>Mencari member...</span>
            </div>
        </div>
    `;


    try {

        const result =
            await apiFetch(
                `/api/customers?storeId=${encodeURIComponent(
                    STORE_ID
                )}&search=${encodeURIComponent(
                    search
                )}`
            );


        const members =
            result.data || [];


        if (!members.length) {

            resultsContainer.innerHTML = `
                <div class="member-result">
                    <span>🔍</span>

                    <div class="member-result-info">
                        <strong>Member tidak ditemukan</strong>
                        <span>
                            Coba nama, nomor HP, atau ID member
                        </span>
                    </div>
                </div>
            `;

            return;
        }


        resultsContainer.innerHTML =
            members
                .map(
                    member => `
                        <button
                            type="button"
                            class="member-result"
                            data-member-id="${member.id}"
                        >

                            <span class="member-result-avatar">
                                👤
                            </span>

                            <span class="member-result-info">

                                <strong>
                                    ${escapeHtml(
                                        member.name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        member.memberCode
                                    )}
                                    ${
                                        member.phone
                                            ? ` • ${escapeHtml(
                                                member.phone
                                            )}`
                                            : ""
                                    }
                                </span>

                            </span>

                            <span class="member-result-points">
                                ⭐ ${Number(
                                    member.loyaltyPoints || 0
                                )} poin
                            </span>

                        </button>
                    `
                )
                .join("");


        resultsContainer
            .querySelectorAll(
                "[data-member-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const member =
                            members.find(
                                item =>
                                    item.id ===
                                    button.dataset.memberId
                            );


                        if (member) {

                            selectCustomer(
                                member
                            );

                        }

                    }
                );

            });


    } catch (error) {

        console.error(
            "SEARCH MEMBER ERROR:",
            error
        );


        resultsContainer.innerHTML = `
            <div class="member-result">
                <span>⚠️</span>

                <div class="member-result-info">
                    <strong>Gagal mencari member</strong>
                    <span>
                        ${escapeHtml(
                            error.message ||
                            "Terjadi kesalahan"
                        )}
                    </span>
                </div>
            </div>
        `;
    }
}

/* =========================================================
   CUSTOMER MANAGEMENT PAGE
   ========================================================= */

   let customersSearchTimer = null;
   let editingCustomerId = null;

   /* =========================
      LOAD CUSTOMERS
      ========================= */

   async function loadCustomers(keyword = "") {
       const tbody = document.getElementById("customersTableBody");
       const loading = document.getElementById("customersLoading");
       const errorBox = document.getElementById("customersError");
       const emptyBox = document.getElementById("customersEmpty");

       if (!tbody) return;

       loading?.classList.remove("hidden");
       errorBox?.classList.add("hidden");
       emptyBox?.classList.add("hidden");

       try {
           const url =
               `/api/customers?storeId=${encodeURIComponent(STORE_ID)}` +
               (keyword.trim()
                   ? `&search=${encodeURIComponent(keyword.trim())}`
                   : "");

           const result = await apiFetch(url);

           if (result.success === false) {
               throw new Error(result.message || "Gagal memuat pelanggan.");
           }

           const customers = Array.isArray(result.data)
               ? result.data
               : [];

           renderCustomersTable(customers);
           updateCustomersStats(customers);
       } catch (error) {
           console.error("LOAD CUSTOMERS ERROR:", error);

           tbody.innerHTML = `
               <tr>
                   <td colspan="6">Gagal memuat data pelanggan.</td>
               </tr>
           `;

           if (errorBox) {
               errorBox.textContent =
                   error.message || "Gagal memuat pelanggan.";
               errorBox.classList.remove("hidden");
           }
       } finally {
           loading?.classList.add("hidden");
       }
   }

   /* =========================
      RENDER CUSTOMER TABLE
      ========================= */

   function renderCustomersTable(customers) {
       const tbody = document.getElementById("customersTableBody");
       const emptyBox = document.getElementById("customersEmpty");

       if (!tbody) return;

       if (!customers.length) {
           tbody.innerHTML = "";
           emptyBox?.classList.remove("hidden");
           return;
       }

       emptyBox?.classList.add("hidden");

       tbody.innerHTML = customers.map(customer => `
           <tr>
               <td>${escapeHtml(customer.name || "Tanpa nama")}</td>
               <td>${escapeHtml(customer.memberCode || "-")}</td>
               <td>${escapeHtml(customer.phone || "-")}</td>
               <td>
                   ⭐ ${Number(customer.loyaltyPoints || 0)
                       .toLocaleString("id-ID")}
               </td>
               <td>${formatRupiah(customer.totalSpent || 0)}</td>
               <td>
                   <div class="customer-row-actions">
                       <button
                           type="button"
                           class="customer-edit-btn"
                           data-action="edit"
                           data-id="${escapeHtml(customer.id)}"
                       >Edit</button>
                   </div>
               </td>
           </tr>
       `).join("");
   }

   /* =========================
      CUSTOMER STATISTICS
      ========================= */

   function updateCustomersStats(customers) {
       const count = document.getElementById("customerTotalCount");
       const points = document.getElementById("customerTotalPoints");
       const spent = document.getElementById("customerTotalSpent");

       if (count) {
           count.textContent = customers.length.toLocaleString("id-ID");
       }

       if (points) {
           points.textContent = customers.reduce(
               (sum, customer) =>
                   sum + Number(customer.loyaltyPoints || 0),
               0
           ).toLocaleString("id-ID");
       }

       if (spent) {
           spent.textContent = formatRupiah(
               customers.reduce(
                   (sum, customer) =>
                       sum + Number(customer.totalSpent || 0),
                   0
               )
           );
       }
   }

   /* =========================
      CUSTOMER PAGE EVENTS
      ========================= */

   function setupCustomersPage() {
       setupCustomerModal();

       const input = document.getElementById("customerSearchInput");
       const refresh = document.getElementById("refreshCustomersBtn");
       const addButton = document.getElementById("addCustomerBtn");
       const tbody = document.getElementById("customersTableBody");

       if (input && !input.dataset.bound) {
           input.dataset.bound = "true";

           input.addEventListener("input", () => {
               clearTimeout(customersSearchTimer);

               customersSearchTimer = setTimeout(() => {
                   loadCustomers(input.value);
               }, 300);
           });
       }

       if (refresh && !refresh.dataset.bound) {
           refresh.dataset.bound = "true";

           refresh.addEventListener("click", () => {
               loadCustomers(input?.value || "");
           });
       }

       if (addButton && !addButton.dataset.bound) {
           addButton.dataset.bound = "true";

           addButton.addEventListener("click", () => {
               openCustomerModal();
           });
       }

       if (tbody && !tbody.dataset.actionsBound) {
           tbody.dataset.actionsBound = "true";

           tbody.addEventListener("click", async (event) => {
               const button = event.target.closest("button[data-action]");

               if (!button) return;

               const customerId = button.dataset.id;
               const action = button.dataset.action;

               if (!customerId) {
                   alert("ID member tidak ditemukan.");
                   return;
               }

               if (action === "edit") {
                   button.disabled = true;

                   try {
                       const result = await apiFetch(
                           `/api/customers/${encodeURIComponent(customerId)}` +
                           `?storeId=${encodeURIComponent(STORE_ID)}`
                       );

                       if (!result.success || !result.data) {
                           throw new Error(
                               result.message || "Data member tidak ditemukan."
                           );
                       }

                       openCustomerModal(result.data);
                   } catch (error) {
                       console.error("GET CUSTOMER ERROR:", error);

                       alert(
                           error.message || "Gagal mengambil data member."
                       );
                   } finally {
                       button.disabled = false;
                   }

                   return;
               }
           });
       }
   }

   /* =========================
      OPEN CUSTOMER MODAL
      ========================= */

   function openCustomerModal(customer = null) {
       const modal = document.getElementById("customerModal");
       const form = document.getElementById("customerForm");
       const errorBox = document.getElementById("customerFormError");
       const title = document.getElementById("customerModalTitle");
       const saveBtn = document.getElementById("saveCustomerBtn");
       const nameInput = document.getElementById("customerNameInput");
       const phoneInput = document.getElementById("customerPhoneInput");
       const emailInput = document.getElementById("customerEmailInput");

       if (!modal || !form) return;

       editingCustomerId = customer?.id || null;

       form.reset();

       if (title) {
           title.textContent = customer ? "Edit Member" : "Tambah Member";
       }

       if (saveBtn) {
           saveBtn.textContent = customer
               ? "Simpan Perubahan"
               : "Simpan Member";
       }

       if (nameInput) nameInput.value = customer?.name || "";
       if (phoneInput) phoneInput.value = customer?.phone || "";
       if (emailInput) emailInput.value = customer?.email || "";

       errorBox?.classList.add("hidden");

       if (errorBox) errorBox.textContent = "";

       modal.classList.remove("hidden");
       nameInput?.focus();
   }

   /* =========================
      CLOSE CUSTOMER MODAL
      ========================= */

   function closeCustomerModal() {
       document.getElementById("customerModal")?.classList.add("hidden");
       editingCustomerId = null;
   }

   /* =========================
      CUSTOMER FORM EVENTS
      ========================= */

   function setupCustomerModal() {
       const form = document.getElementById("customerForm");
       const closeBtn = document.getElementById("closeCustomerModalBtn");
       const cancelBtn = document.getElementById("cancelCustomerModalBtn");
       const backdrop = document.getElementById("customerModalBackdrop");

       if (closeBtn && !closeBtn.dataset.bound) {
           closeBtn.dataset.bound = "true";
           closeBtn.addEventListener("click", closeCustomerModal);
       }

       if (cancelBtn && !cancelBtn.dataset.bound) {
           cancelBtn.dataset.bound = "true";
           cancelBtn.addEventListener("click", closeCustomerModal);
       }

       if (backdrop && !backdrop.dataset.bound) {
           backdrop.dataset.bound = "true";
           backdrop.addEventListener("click", closeCustomerModal);
       }

       if (form && !form.dataset.bound) {
           form.dataset.bound = "true";

           form.addEventListener("submit", async (event) => {
               event.preventDefault();

               const nameInput = document.getElementById("customerNameInput");
               const phoneInput = document.getElementById("customerPhoneInput");
               const emailInput = document.getElementById("customerEmailInput");
               const errorBox = document.getElementById("customerFormError");
               const saveBtn = document.getElementById("saveCustomerBtn");

               const name = nameInput?.value.trim() || "";
               const phone = phoneInput?.value.trim() || "";
               const email = emailInput?.value.trim() || "";

               if (!name) {
                   if (errorBox) {
                       errorBox.textContent = "Nama member wajib diisi.";
                       errorBox.classList.remove("hidden");
                   }

                   nameInput?.focus();
                   return;
               }

               const isEditing = Boolean(editingCustomerId);

               if (saveBtn) {
                   saveBtn.disabled = true;
                   saveBtn.textContent = "Menyimpan...";
               }

               errorBox?.classList.add("hidden");

               try {
                   const url = isEditing
                       ? `/api/customers/${encodeURIComponent(editingCustomerId)}`
                       : "/api/customers";

                   const result = await apiFetch(url, {
                       method: isEditing ? "PATCH" : "POST",
                       headers: {
                           "Content-Type": "application/json"
                       },
                       body: JSON.stringify({
                           storeId: STORE_ID,
                           name,
                           phone,
                           email
                       })
                   });

                   if (result.success === false) {
                       throw new Error(
                           result.message ||
                           (isEditing
                               ? "Gagal memperbarui member."
                               : "Gagal menambahkan member.")
                       );
                   }

                   closeCustomerModal();

                   await loadCustomers(
                       document.getElementById("customerSearchInput")?.value || ""
                   );

                   alert(
                       isEditing
                           ? "Data member berhasil diperbarui!"
                           : "Member berhasil ditambahkan!"
                   );
               } catch (error) {
                   console.error("SAVE CUSTOMER ERROR:", error);

                   if (errorBox) {
                       errorBox.textContent =
                           error.message || "Gagal menyimpan member.";

                       errorBox.classList.remove("hidden");
                   }
               } finally {
                   if (saveBtn) {
                       saveBtn.disabled = false;
                       saveBtn.textContent = editingCustomerId
                           ? "Simpan Perubahan"
                           : "Simpan Member";
                   }
               }
           });
       }
   }


function selectCustomer(member) {

    selectedCustomer =
        member;

    selectedPointsToRedeem =
        0;


    const searchInput =
        document.getElementById(
            "memberSearch"
        );

    const resultsContainer =
        document.getElementById(
            "memberSearchResults"
        );

    const selectedCard =
        document.getElementById(
            "selectedMemberCard"
        );

    const walkInButton =
        document.getElementById(
            "walkInCustomerBtn"
        );

    const customerStatus =
        document.getElementById(
            "customerStatus"
        );


    if (searchInput) {

        searchInput.value =
            "";

    }


    if (resultsContainer) {

        resultsContainer.innerHTML =
            "";

        resultsContainer.classList.add(
            "hidden"
        );

    }


    if (selectedCard) {

        selectedCard.classList.remove(
            "hidden"
        );

    }


    if (walkInButton) {

        walkInButton.classList.remove(
            "active"
        );

    }


    if (customerStatus) {

        customerStatus.textContent =
            "Member";

    }


    const name =
        document.getElementById(
            "selectedMemberName"
        );

    const code =
        document.getElementById(
            "selectedMemberCode"
        );

    const points =
        document.getElementById(
            "selectedMemberPoints"
        );

    const spent =
        document.getElementById(
            "selectedMemberSpent"
        );


    if (name) {

        name.textContent =
            member.name || "-";

    }


    if (code) {

        code.textContent =
            member.memberCode || "-";

    }


    if (points) {

        points.textContent =
            Number(
                member.loyaltyPoints || 0
            ).toLocaleString(
                "id-ID"
            );

    }


    if (spent) {

        spent.textContent =
            formatRupiah(
                Number(
                    member.totalSpent || 0
                )
            );

    }


    const redeemSection =
        document.getElementById(
            "redeemPointsSection"
        );


    if (
        redeemSection &&
        Number(member.loyaltyPoints || 0) >= 100
    ) {

        redeemSection.classList.remove(
            "hidden"
        );

    } else if (redeemSection) {

        redeemSection.classList.add(
            "hidden"
        );

    }


    const redeemToggle =
        document.getElementById(
            "redeemPointsToggle"
        );

    const redeemInputWrapper =
        document.getElementById(
            "redeemPointsInputWrapper"
        );


    if (redeemToggle) {

        redeemToggle.checked =
            false;

    }


    if (redeemInputWrapper) {

        redeemInputWrapper.classList.add(
            "hidden"
        );

    }


    updatePointsDiscountPreview();

}


function clearSelectedCustomer() {

    selectedCustomer =
        null;

    selectedPointsToRedeem =
        0;


    const selectedCard =
        document.getElementById(
            "selectedMemberCard"
        );

    const walkInButton =
        document.getElementById(
            "walkInCustomerBtn"
        );

    const customerStatus =
        document.getElementById(
            "customerStatus"
        );

    const redeemToggle =
        document.getElementById(
            "redeemPointsToggle"
        );

    const redeemInputWrapper =
        document.getElementById(
            "redeemPointsInputWrapper"
        );

    const searchInput =
        document.getElementById(
            "memberSearch"
        );


    if (selectedCard) {

        selectedCard.classList.add(
            "hidden"
        );

    }


    if (walkInButton) {

        walkInButton.classList.add(
            "active"
        );

    }


    if (customerStatus) {

        customerStatus.textContent =
            "Walk-in";

    }


    if (redeemToggle) {

        redeemToggle.checked =
            false;

    }


    if (redeemInputWrapper) {

        redeemInputWrapper.classList.add(
            "hidden"
        );

    }


    if (searchInput) {

        searchInput.value =
            "";

    }


    updatePointsDiscountPreview();

}

function updatePointsDiscountPreview() {
    const input = document.getElementById("redeemPointsInput");
    const preview = document.getElementById("pointsDiscountPreview");

    if (!input || !preview) return;

    let points = Number(input.value) || 0;

    if (
        !selectedCustomer ||
        points < 100 ||
        points % 100 !== 0
    ) {
        selectedPointsToRedeem = 0;
        preview.textContent = formatRupiah(0);

        updateSummary();
        return;
    }

    const availablePoints = Number(
        selectedCustomer.loyaltyPoints || 0
    );

    if (points > availablePoints) {
        points = Math.floor(availablePoints / 100) * 100;
        input.value = points;
    }

    selectedPointsToRedeem = points;

    const discount = (points / 100) * 10000;

    preview.textContent = formatRupiah(discount);

    // Perbarui total pembayaran
    updateSummary();
}

   /* =========================================================
      INITIALIZE
      ========================================================= */

   async function init() {

       try {

           /* ================================================
              AUTH
              ================================================ */

           setupLoginUi();

           let authSettings;

           try {
               authSettings = await fetchAuthSettings();
           } catch (error) {
               showLoginScreen(
                   "Pengaturan login tidak dapat diperiksa. Pastikan backend SmartPOS aktif."
               );
               console.error("AUTH SETTINGS INIT ERROR:", error);
               return;
           }

           const storedUser = getStoredUser();

           // Login OFF: jangan pertahankan sesi berhak tinggi dari browser lama.
           if (!authSettings.requiredLogin &&
               token &&
               storedUser?.isGuest !== true) {
               localStorage.removeItem("smartpos_token");
               localStorage.removeItem("smartpos_user");
               token = null;
           }

           if (storedUser?.isGuest === true && authSettings.requiredLogin) {
               localStorage.removeItem("smartpos_token");
               localStorage.removeItem("smartpos_user");
               token = null;
           }

           if (!token && authSettings.requiredLogin) {
               showLoginScreen();
               return;
           }

           if (!token && !authSettings.requiredLogin) {
               try {
                   await createGuestSession();
               } catch (error) {
                   showLoginScreen(error.message || "Sesi kasir otomatis gagal dibuat.");
                   return;
               }
           }

           const settingsLogoutButton = document.getElementById("settingsLogoutButton");
           if (settingsLogoutButton) {
               settingsLogoutButton.hidden = getStoredUser()?.isGuest === true;
           }


           /* ================================================
              NAVIGATION
              ================================================ */

           setupNavigation();
           document.documentElement.dataset.theme = "light";
           try {
               localStorage.setItem("smartpos_theme", "light");
           } catch (error) {
               console.warn("Preferensi tema tidak dapat disimpan.", error);
           }
           setupSettingsNavigation();


           /* ================================================
              POS EVENTS
              ================================================ */

           setupEvents();


           /* ================================================
              INVENTORY EVENTS
              ================================================ */

           setupInventoryEvents();


           /* ================================================
              TRANSACTION EVENTS
              ================================================ */

           setupTransactionEvents();


           /* ================================================
              DEFAULT PAYMENT
              ================================================ */

           setPaymentMethod(
               "CASH"
           );


           /* ================================================
              SOCKET
              ================================================ */

           connectSocket();


           /* ================================================
              PRODUCTS
              ================================================ */

           await loadProducts();


           /* ================================================
              DASHBOARD
              ================================================ */
           setupDashboardPeriodFilter();
           await loadDashboard();


           /* ================================================
              ANALYTICS
              ================================================ */

              setupAnalyticsDateFilters();
    setupReportsEvents();

              await loadAnalytics(7);


           /* ================================================
              CART
              ================================================ */

           renderCart();


           renderCurrentUser(getStoredUser());
           hideLoginScreen();

           console.log(
               "🚀 SmartPOS frontend ready"
           );


       } catch (error) {

           console.error(
               "INIT ERROR:",
               error
           );

           if (!token) {
               showLoginScreen(error.message);
               return;
           }


           showToast(
               "Gagal menghubungkan SmartPOS",
               "error"
           );

       }

   }


   /* =========================================================
      DOM READY
      ========================================================= */

   document.addEventListener(
       "DOMContentLoaded",
       init
   );


/* =========================================
   SMARTPOS EXPENSES
   ========================================= */

let editingExpenseId = null;
let cachedExpenses = [];

const expenseElement = (id) => document.getElementById(id);

function expenseRupiah(amount) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);
}

function expenseDateValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function expenseDateLabel(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleDateString("id-ID");
}

function expenseStatusLabel(expense) {
    if (expense.paymentStatus === "PAID") return "Lunas";
    if (!expense.dueDate) return "Belum Lunas";

    const due = expenseDateValue(expense.dueDate);
    const today = expenseDateValue(new Date());

    if (due < today) return "Terlambat";
    if (due === today) return "Jatuh Tempo Hari Ini";
    return "Belum Jatuh Tempo";
}

function expenseInPeriod(expense, period) {
    const date = new Date(expense.expenseDate);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === "today") return date >= startToday;

    if (period === "week") {
        const startWeek = new Date(startToday);
        const day = (startWeek.getDay() + 6) % 7;
        startWeek.setDate(startWeek.getDate() - day);
        return date >= startWeek;
    }

    if (period === "month") {
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return date >= startMonth;
    }

    return true;
}

async function loadExpenses() {
    const tbody = expenseElement("expensesTableBody");
    const loading = expenseElement("expensesLoading");
    const errorBox = expenseElement("expensesError");
    const emptyBox = expenseElement("expensesEmpty");

    if (!tbody) return;

    loading?.classList.remove("hidden");
    errorBox?.classList.add("hidden");
    emptyBox?.classList.add("hidden");

    try {
        const result = await apiFetch(
            `/api/expenses?storeId=${encodeURIComponent(STORE_ID)}`
        );

        if (result.success === false) {
            throw new Error(result.message || "Gagal memuat pengeluaran.");
        }

        cachedExpenses = Array.isArray(result.data) ? result.data : [];

        const totalAmount = cachedExpenses.reduce(
            (sum, item) => sum + Number(item.amount || 0), 0
        );

        if (expenseElement("expenseTotalCount")) {
            expenseElement("expenseTotalCount").textContent = cachedExpenses.length;
        }
        if (expenseElement("expenseTotalAmount")) {
            expenseElement("expenseTotalAmount").textContent = expenseRupiah(totalAmount);
        }

        const periodTotals = {
            today: cachedExpenses.filter(e => expenseInPeriod(e, "today")),
            week: cachedExpenses.filter(e => expenseInPeriod(e, "week")),
            month: cachedExpenses.filter(e => expenseInPeriod(e, "month"))
        };

        for (const [period, items] of Object.entries(periodTotals)) {
            const amount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const amountEl = expenseElement(`expenseTotal${period[0].toUpperCase()}${period.slice(1)}`);
            const countEl = expenseElement(`expenseCount${period[0].toUpperCase()}${period.slice(1)}`);
            if (amountEl) amountEl.textContent = expenseRupiah(amount);
            if (countEl) countEl.textContent = items.length;
        }

        renderExpenses();

    } catch (error) {
        console.error("LOAD EXPENSES ERROR:", error);
        if (errorBox) {
            errorBox.textContent = error.message || "Gagal memuat pengeluaran.";
            errorBox.classList.remove("hidden");
        }
        tbody.innerHTML = '<tr><td colspan="7">Gagal memuat data pengeluaran.</td></tr>';
    } finally {
        loading?.classList.add("hidden");
    }
}

function renderExpenses() {
    const tbody = expenseElement("expensesTableBody");
    if (!tbody) return;

    const search = (expenseElement("expenseSearchInput")?.value || "").toLowerCase();
    const period = expenseElement("expensePeriodFilter")?.value || "all";
    const status = expenseElement("expenseStatusFilter")?.value || "all";

    const filtered = cachedExpenses.filter(expense => {
        const matchesSearch = [
            expense.description, expense.category
        ].some(value => String(value || "").toLowerCase().includes(search));

        const matchesPeriod = period === "all" || expenseInPeriod(expense, period);
        const matchesStatus = status === "all" ||
            (status === "PAID" && expense.paymentStatus === "PAID") ||
            (status === "UNPAID" && expense.paymentStatus !== "PAID") ||
            (status === "OVERDUE" && expenseStatusLabel(expense) === "Terlambat");

        return matchesSearch && matchesPeriod && matchesStatus;
    });

    tbody.innerHTML = "";

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7">Tidak ada pengeluaran yang cocok.</td></tr>';
        return;
    }

    filtered.forEach(expense => {
        const row = document.createElement("tr");
        const values = [
            expenseDateLabel(expense.expenseDate),
            expense.description || "-",
            expense.category || "Lainnya",
            expenseRupiah(expense.amount),
            expense.dueDate ? expenseDateLabel(expense.dueDate) : "-",
            expenseStatusLabel(expense)
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (index === 5) {
                cell.className = expense.paymentStatus === "PAID"
                    ? "expense-status-paid" : "expense-status-unpaid";
            }
            row.appendChild(cell);
        });

        const actions = document.createElement("td");
        actions.className = "expense-actions-cell";

        const actionGroup = document.createElement("div");
        actionGroup.className = "expense-actions-group";

        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Edit";
        edit.className = "customer-cancel-btn";
        edit.addEventListener("click", () => openExpenseModal(expense));

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Hapus";
        remove.className = "customer-cancel-btn expense-delete-btn";
        remove.style.marginLeft = "6px";
        remove.addEventListener("click", () => deleteExpense(expense.id));

        actionGroup.append(edit, remove);
        actions.appendChild(actionGroup);
        row.appendChild(actions);
        tbody.appendChild(row);
    });
}

function openExpenseModal(expense = null) {
    const modal = expenseElement("expenseModal");
    const form = expenseElement("expenseForm");
    if (!modal || !form) {
        alert("Formulir pengeluaran tidak ditemukan.");
        return;
    }

    editingExpenseId = expense?.id || null;
    form.reset();

    expenseElement("expenseModalTitle").textContent =
        expense ? "Edit Pengeluaran" : "Tambah Pengeluaran";
    expenseElement("saveExpenseBtn").textContent =
        expense ? "Simpan Perubahan" : "Simpan Pengeluaran";

    expenseElement("expenseDescriptionInput").value = expense?.description || "";
    expenseElement("expenseCategoryInput").value = expense?.category || "Operasional";
    expenseElement("expenseAmountInput").value = expense?.amount ?? "";
    expenseElement("expenseDateInput").value =
        expenseDateValue(expense?.expenseDate || new Date());
    expenseElement("expenseDueDateInput").value =
        expenseDateValue(expense?.dueDate);
    expenseElement("expensePaymentStatusInput").value =
        expense?.paymentStatus || "UNPAID";

    expenseElement("expenseFormError")?.classList.add("hidden");
    modal.classList.remove("hidden");
}

function closeExpenseModal() {
    expenseElement("expenseModal")?.classList.add("hidden");
    editingExpenseId = null;
}

async function saveExpenseForm(event) {
    event.preventDefault();

    const formError = expenseElement("expenseFormError");
    const saveButton = expenseElement("saveExpenseBtn");
    const dueDate = expenseElement("expenseDueDateInput").value;

    const payload = {
        storeId: STORE_ID,
        description: expenseElement("expenseDescriptionInput").value.trim(),
        category: expenseElement("expenseCategoryInput").value,
        amount: Number(expenseElement("expenseAmountInput").value),
        expenseDate: expenseElement("expenseDateInput").value,
        dueDate: dueDate || null,
        paymentStatus: expenseElement("expensePaymentStatusInput").value
    };

    if (!payload.description || !Number.isFinite(payload.amount) || payload.amount <= 0) {
        if (formError) {
            formError.textContent = "Isi deskripsi dan nominal yang valid.";
            formError.classList.remove("hidden");
        }
        return;
    }

    saveButton.disabled = true;
    if (formError) formError.classList.add("hidden");

    try {
        const result = await apiFetch(
            editingExpenseId
                ? `/api/expenses/${encodeURIComponent(editingExpenseId)}`
                : "/api/expenses",
            {
                method: editingExpenseId ? "PATCH" : "POST",
                body: JSON.stringify(payload)
            }
        );

        if (result.success === false) {
            throw new Error(result.message || "Gagal menyimpan pengeluaran.");
        }

        closeExpenseModal();
        await loadExpenses();
        alert(editingExpenseId ? "Pengeluaran diperbarui." : "Pengeluaran ditambahkan.");
    } catch (error) {
        console.error("SAVE EXPENSE ERROR:", error);
        if (formError) {
            formError.textContent = error.message || "Gagal menyimpan pengeluaran.";
            formError.classList.remove("hidden");
        }
    } finally {
        saveButton.disabled = false;
    }
}

async function deleteExpense(id) {
    const confirmed = await showConfirmDialog({
        title: "Hapus Pengeluaran?",
        message: "Pengeluaran ini akan dihapus. Tindakan ini tidak dapat dibatalkan.",
        confirmText: "Ya, Hapus",
        cancelText: "Batal",
        danger: true
    });
    if (!confirmed) return;

    try {
        const result = await apiFetch(
            `/api/expenses/${encodeURIComponent(id)}?storeId=${encodeURIComponent(STORE_ID)}`,
            { method: "DELETE" }
        );
        if (result.success === false) throw new Error(result.message || "Gagal menghapus.");

        await loadExpenses();
        alert("Pengeluaran berhasil dihapus.");
    } catch (error) {
        console.error("DELETE EXPENSE ERROR:", error);
        alert(error.message || "Gagal menghapus pengeluaran.");
    }
}

expenseElement("addExpenseBtn")?.addEventListener("click", () => openExpenseModal());
expenseElement("refreshExpensesBtn")?.addEventListener("click", loadExpenses);
expenseElement("expenseForm")?.addEventListener("submit", saveExpenseForm);
expenseElement("closeExpenseModalBtn")?.addEventListener("click", closeExpenseModal);
expenseElement("cancelExpenseModalBtn")?.addEventListener("click", closeExpenseModal);
expenseElement("expenseModalBackdrop")?.addEventListener("click", closeExpenseModal);

["expenseSearchInput", "expensePeriodFilter", "expenseStatusFilter"].forEach(id => {
    expenseElement(id)?.addEventListener("input", renderExpenses);
    expenseElement(id)?.addEventListener("change", renderExpenses);
});


document.addEventListener("input", function (event) {
    const target = event.target;
    if (
        target &&
        (target.id === "discountPercentInput" ||
         target.id === "taxPercentInput")
    ) {
        const value = Number(target.value);
        if (target.value !== "" && Number.isFinite(value)) {
            target.value = String(Math.min(100, Math.max(0, value)));
        }
        updateSummary();
    }
});
