/* ============================================================
   ⚙️ KONFIGURASI — EDIT BAGIAN INI SESUAI WARUNG LO
   ============================================================ */
const CONFIG = {
  WA_NUMBER: "6281234567890",        // <-- ganti dengan no. WA Warung GenZ (format 62xxxx, tanpa + atau 0 di depan)
  BANK_NAME: "BCA",                  // <-- ganti nama bank
  BANK_NUMBER: "1234567890",         // <-- ganti no. rekening
  BANK_HOLDER: "Warung GenZ",        // <-- ganti nama pemilik rekening
  ADMIN_PIN: "genz2026",             // <-- ganti PIN admin, jangan dishare ke sembarang orang
  SUPABASE_URL: "https://gsjhqounfebyalkknnza.supabase.co",   // Project URL lo
  SUPABASE_KEY: "sb_publishable_s2AAr-jH9ZZP19lQwi93jg_7FO0hOUA"  // sudah diisi pakai publishable key lo
};

// Klien Supabase buat baca/tulis data pesanan
const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/* ============================================================
   🍛 DATA MENU — EDIT / TAMBAH MENU DI SINI
   ============================================================ */
const MENU = [
  { id:"m1", name:"Nasi Goreng GenZ", cat:"makanan", price:18000, emoji:"🍛" },
  { id:"m2", name:"Mie Ayam Kekinian", cat:"makanan", price:15000, emoji:"🍜" },
  { id:"m3", name:"Ayam Geprek Sultan", cat:"makanan", price:20000, emoji:"🍗" },
  { id:"m4", name:"Bakso Mercon", cat:"makanan", price:17000, emoji:"🥩" },
  { id:"m5", name:"Roti Bakar Coklat Keju", cat:"makanan", price:12000, emoji:"🍞" },
  { id:"d1", name:"Es Kopi Susu Gula Aren", cat:"minuman", price:12000, emoji:"☕" },
  { id:"d2", name:"Es Teh Leci", cat:"minuman", price:8000, emoji:"🧊" },
  { id:"d3", name:"Matcha Latte", cat:"minuman", price:15000, emoji:"🍵" },
  { id:"d4", name:"Jus Alpukat", cat:"minuman", price:13000, emoji:"🥑" },
  { id:"d5", name:"Lemon Tea Soda", cat:"minuman", price:10000, emoji:"🍋" }
];

const STATUS_STYLE = {
  "Menunggu Verifikasi": "wait",
  "Menunggu Konfirmasi": "wait",
  "Lunas": "ok",
  "Diproses": "ok",
  "Selesai": "done",
  "Dibatalkan": "cancel"
};
const STATUS_LIST = ["Menunggu Verifikasi","Menunggu Konfirmasi","Lunas","Diproses","Selesai","Dibatalkan"];

/* ============================================================
   STATE
   ============================================================ */
let cart = {};          // { itemId: qty }
let activeCat = "semua";
let selectedPayment = "transfer";
let lastOrderForWA = null;

/* ============================================================
   HELPERS
   ============================================================ */
function rupiah(n){ return "Rp" + n.toLocaleString("id-ID"); }

function toast(msg){
  const box = document.getElementById("toastBox");
  box.textContent = msg;
  box.classList.add("show");
  clearTimeout(box._t);
  box._t = setTimeout(()=>box.classList.remove("show"), 2200);
}

function genOrderId(){
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).toUpperCase().slice(2,5);
  return "WGZ-" + t + r;
}

// Cart cuma disimpen di memori browser (reset kalau halaman direfresh, normal kok buat e-commerce)

/* ============================================================
   NAVIGATION
   ============================================================ */
function goView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("view-"+name).classList.add("active");
  document.querySelectorAll(".nav-pill").forEach(p=>p.classList.toggle("active", p.dataset.view===name));
  window.scrollTo({top:0, behavior:"instant"});
  if(name==="admin" && document.getElementById("adminPanel").style.display==="block"){
    loadAdminOrders();
  }
}

/* ============================================================
   MENU RENDERING
   ============================================================ */
function renderMenu(){
  const grid = document.getElementById("menuGrid");
  const items = MENU.filter(m => activeCat==="semua" || m.cat===activeCat);
  grid.innerHTML = items.map(item=>{
    const qty = cart[item.id] || 0;
    const action = qty>0
      ? `<div class="stepper">
           <button onclick="changeQty('${item.id}',-1)" aria-label="Kurangi">−</button>
           <span>${qty}</span>
           <button onclick="changeQty('${item.id}',1)" aria-label="Tambah">+</button>
         </div>`
      : `<button class="add-btn" onclick="changeQty('${item.id}',1)">+ Tambah</button>`;
    return `
      <div class="card">
        <div class="card-emoji">${item.emoji}</div>
        <div class="card-cat">${item.cat}</div>
        <h3>${item.name}</h3>
        <div class="card-price">${rupiah(item.price)}</div>
        <div class="card-action">${action}</div>
      </div>`;
  }).join("");
}

document.getElementById("catPills").addEventListener("click", e=>{
  const btn = e.target.closest(".pill");
  if(!btn) return;
  activeCat = btn.dataset.cat;
  document.querySelectorAll(".pill").forEach(p=>p.classList.toggle("active", p===btn));
  renderMenu();
});

/* ============================================================
   CART LOGIC
   ============================================================ */
function changeQty(id, delta){
  const newQty = (cart[id]||0) + delta;
  if(newQty <= 0){ delete cart[id]; } else { cart[id] = newQty; }
  renderMenu();
  renderCart();
}

function cartItemsArray(){
  return Object.entries(cart).map(([id,qty])=>{
    const item = MENU.find(m=>m.id===id);
    return item ? {...item, qty} : null;
  }).filter(Boolean);
}

function cartTotal(){
  return cartItemsArray().reduce((sum,it)=>sum + it.price*it.qty, 0);
}

function renderCart(){
  const items = cartItemsArray();
  const box = document.getElementById("cartItemsBox");
  const count = items.reduce((s,it)=>s+it.qty,0);
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = rupiah(cartTotal());
  document.getElementById("checkoutOpenBtn").disabled = items.length===0;

  if(items.length===0){
    box.innerHTML = `<div class="empty-cart">🧾<br>Struk masih kosong.<br>Yuk pilih menu dulu!</div>`;
    return;
  }
  box.innerHTML = items.map(it=>`
    <div class="receipt-row">
      <div>
        <div class="name">${it.name}</div>
        <div class="meta">
          <div class="stepper">
            <button onclick="changeQty('${it.id}',-1)">−</button>
            <span>${it.qty}</span>
            <button onclick="changeQty('${it.id}',1)">+</button>
          </div>
          <button class="rm-link" onclick="removeItem('${it.id}')">Hapus</button>
        </div>
      </div>
      <div class="price">${rupiah(it.price*it.qty)}</div>
    </div>
  `).join("");
}

function removeItem(id){
  delete cart[id];
  renderMenu();
  renderCart();
}

function openCart(){
  document.getElementById("cartDrawer").classList.add("show");
  document.getElementById("cartOverlay").classList.add("show");
}
function closeCart(){
  document.getElementById("cartDrawer").classList.remove("show");
  document.getElementById("cartOverlay").classList.remove("show");
}

/* ============================================================
   CHECKOUT
   ============================================================ */
function selectPayment(method){
  selectedPayment = method;
  document.getElementById("payTransferOpt").classList.toggle("selected", method==="transfer");
  document.getElementById("payCodOpt").classList.toggle("selected", method==="cod");
  renderCheckoutSummary();
}

function renderCheckoutSummary(){
  const items = cartItemsArray();
  const rows = items.map(it=>`<div class="r"><span>${it.name} x${it.qty}</span><span>${rupiah(it.price*it.qty)}</span></div>`).join("");
  document.getElementById("checkoutSummary").innerHTML = rows + `<div class="r tot"><span>TOTAL</span><span>${rupiah(cartTotal())}</span></div>`;
}

function openCheckout(){
  if(cartItemsArray().length===0) return;
  renderCheckoutSummary();
  closeCart();
  document.getElementById("checkoutModal").classList.add("show");
}

function closeModal(id){
  document.getElementById(id).classList.remove("show");
}

function buildWAMessage(order){
  const lines = order.items.map(it=>`- ${it.name} x${it.qty} = ${rupiah(it.price*it.qty)}`).join("\n");
  let msg = `Halo Warung GenZ! 👋\nMau konfirmasi pesanan:\n\nID Pesanan: ${order.id}\nNama: ${order.name}\nNo. HP: ${order.phone}\nAlamat/Catatan: ${order.address || "-"}\n\nPesanan:\n${lines}\n\nTotal: ${rupiah(order.total)}\n`;
  msg += order.payment==="transfer"
    ? "Bukti transfer saya lampirkan di chat ini ya 🙏"
    : "Mohon dikonfirmasi pesanannya, makasih! 🙏";
  return msg;
}

async function submitOrder(){
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();

  let valid = true;
  document.getElementById("errName").style.display = name ? "none" : "block";
  document.getElementById("errPhone").style.display = phone ? "none" : "block";
  if(!name || !phone) valid = false;
  if(selectedPayment==="cod" && !address){
    document.getElementById("errAddress").style.display = "block";
    valid = false;
  } else {
    document.getElementById("errAddress").style.display = "none";
  }
  if(!valid) return;

  const items = cartItemsArray();
  if(items.length===0) return;

  const order = {
    id: genOrderId(),
    name, phone, address,
    items: items.map(it=>({id:it.id,name:it.name,qty:it.qty,price:it.price})),
    total: cartTotal(),
    payment: selectedPayment,
    status: selectedPayment==="transfer" ? "Menunggu Verifikasi" : "Menunggu Konfirmasi",
    created_at: new Date().toISOString()
  };

  const { error } = await sb.from("orders").insert(order);
  if(error){
    toast("Gagal simpan pesanan, coba lagi ya.");
    console.error(error);
    return;
  }

  cart = {};
  renderMenu();
  renderCart();
  closeModal("checkoutModal");
  showConfirmation(order);
}

function showConfirmation(order){
  lastOrderForWA = order;
  const waLink = "https://wa.me/" + CONFIG.WA_NUMBER + "?text=" + encodeURIComponent(buildWAMessage(order));
  const itemLines = order.items.map(it=>`<div class="r"><span>${it.name} x${it.qty}</span><span>${rupiah(it.price*it.qty)}</span></div>`).join("");

  let bankBlock = "";
  if(order.payment==="transfer"){
    bankBlock = `
      <div class="bank-box">
        <div class="bname">${CONFIG.BANK_NAME} a.n. ${CONFIG.BANK_HOLDER}</div>
        <div class="bnum">${CONFIG.BANK_NUMBER}</div>
        <small>Transfer sesuai total, lalu kirim bukti lewat tombol WhatsApp di bawah biar cepet diverifikasi 👇</small>
      </div>`;
  }

  const stampClass = order.payment==="transfer" ? "pending" : "pending";
  const stampText = order.payment==="transfer" ? "Menunggu Verifikasi" : "Menunggu Konfirmasi";

  document.getElementById("confirmBody").innerHTML = `
    <div class="stamp-wrap"><div class="stamp ${stampClass}">${stampText}</div></div>
    <div class="mini-receipt">
      <div class="r"><span>ID Pesanan</span><span>${order.id}</span></div>
      ${itemLines}
      <div class="r tot"><span>TOTAL</span><span>${rupiah(order.total)}</span></div>
    </div>
    ${bankBlock}
    <a class="wa-btn" href="${waLink}" target="_blank" rel="noopener">💬 Kirim Konfirmasi via WhatsApp</a>
    <button class="close-text-btn" onclick="closeConfirm()">Tutup, nanti aja konfirmasinya</button>
  `;
  document.getElementById("confirmModal").classList.add("show");
}

function closeConfirm(){
  document.getElementById("confirmModal").classList.remove("show");
  goView("home");
}

/* ============================================================
   TRACK ORDER
   ============================================================ */
function renderOrderCard(order, withSelect){
  const cls = STATUS_STYLE[order.status] || "wait";
  const itemsText = order.items.map(it=>`${it.name} x${it.qty}`).join(", ");
  const when = new Date(order.created_at).toLocaleString("id-ID");
  const select = withSelect ? `
    <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
      ${STATUS_LIST.map(s=>`<option value="${s}" ${s===order.status?"selected":""}>${s}</option>`).join("")}
    </select>` : "";
  return `
    <div class="order-card">
      <div class="order-top">
        <span class="order-id">${order.id}</span>
        <span class="status-tag ${cls}">${order.status}</span>
      </div>
      <div class="order-items">${itemsText}</div>
      <div class="order-meta">${order.name} · ${order.phone} · ${order.payment==="transfer"?"Transfer":"COD"}</div>
      <div class="order-when">${when}</div>
      <div class="order-bottom">
        <span class="order-total">${rupiah(order.total)}</span>
        ${select}
      </div>
    </div>`;
}

async function searchOrder(){
  const q = document.getElementById("trackInput").value.trim();
  const resultBox = document.getElementById("trackResult");
  if(!q){ toast("Isi ID pesanan atau no. HP dulu ya"); return; }
  resultBox.innerHTML = `<div class="empty-state">Lagi nyari pesanan lo...</div>`;

  try{
    if(q.toUpperCase().startsWith("WGZ")){
      const { data, error } = await sb.from("orders").select("*").eq("id", q.toUpperCase()).maybeSingle();
      if(error || !data){
        resultBox.innerHTML = `<div class="empty-state">Pesanan dengan ID itu gak ketemu 🥲</div>`;
        return;
      }
      resultBox.innerHTML = renderOrderCard(data, false);
      return;
    }
    const { data, error } = await sb.from("orders").select("*").ilike("phone", "%"+q+"%").order("created_at", { ascending:false });
    if(error){ throw error; }
    resultBox.innerHTML = (data && data.length)
      ? data.map(o=>renderOrderCard(o,false)).join("")
      : `<div class="empty-state">Belum ada pesanan dengan no. HP itu 🥲</div>`;
  }catch(e){
    resultBox.innerHTML = `<div class="empty-state">Gagal ambil data, coba lagi ya.</div>`;
    console.error(e);
  }
}

/* ============================================================
   ADMIN
   ============================================================ */
let allOrdersCache = [];

function checkAdminPin(){
  const val = document.getElementById("adminPin").value.trim();
  if(val === CONFIG.ADMIN_PIN){
    document.getElementById("adminGate").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    loadAdminOrders();
  } else {
    toast("PIN salah, coba lagi.");
  }
}

async function loadAdminOrders(){
  const box = document.getElementById("adminOrders");
  box.innerHTML = `<div class="empty-state">Lagi ambil data pesanan...</div>`;
  try{
    const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending:false });
    if(error) throw error;
    allOrdersCache = data || [];
    renderAdminOrders();
  }catch(e){
    box.innerHTML = `<div class="empty-state">Gagal ambil data pesanan.</div>`;
    console.error(e);
  }
}

function renderAdminOrders(){
  const box = document.getElementById("adminOrders");
  const q = (document.getElementById("adminSearch").value || "").toLowerCase();
  const filtered = allOrdersCache.filter(o =>
    !q || o.name.toLowerCase().includes(q) || o.phone.includes(q) || o.id.toLowerCase().includes(q)
  );
  box.innerHTML = filtered.length
    ? filtered.map(o=>renderOrderCard(o, true)).join("")
    : `<div class="empty-state">Belum ada pesanan yang cocok.</div>`;
}

async function updateOrderStatus(id, newStatus){
  try{
    const { error } = await sb.from("orders").update({ status:newStatus }).eq("id", id);
    if(error) throw error;
    const idx = allOrdersCache.findIndex(o=>o.id===id);
    if(idx>-1) allOrdersCache[idx].status = newStatus;
    renderAdminOrders();
    toast("Status pesanan "+id+" diupdate ✅");
  }catch(e){
    toast("Gagal update status.");
    console.error(e);
  }
}

/* ============================================================
   INIT
   ============================================================ */
(function init(){
  renderMenu();
  renderCart();
})();
