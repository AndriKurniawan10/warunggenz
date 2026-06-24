/* ============================================================
   ⚙️ KONFIGURASI — EDIT BAGIAN INI SESUAI WARUNG LO
   ============================================================ */
const CONFIG = {
  WA_NUMBER: "6289501201052",       // No. WA Warung GenZ
  ADMIN_PIN: "genz2026",            // <-- ganti PIN admin, jangan dishare ke sembarang orang
  SUPABASE_URL: "https://gsjhqounfebyalkknnza.supabase.co",
  SUPABASE_KEY: "sb_publishable_s2AAr-jH9ZZP19lQwi93jg_7FO0hOUA",
  REKENING: [
    { bank:"BCA",  number:"2110378303",  holder:"Bagus Mukridin" },
    { bank:"DANA", number:"089501201052", holder:"Hasanudin" }
  ]
};

// Klien Supabase buat baca/tulis data pesanan
const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/* ============================================================
   🍛 MENU — dikelola dari Admin, tersimpan di Supabase
   ============================================================ */

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
let MENU = [];           // diisi dari Supabase
let cart = {};           // { itemId: qty }
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
   MENU FROM SUPABASE
   ============================================================ */
async function loadMenuFromDB(){
  const grid = document.getElementById("menuGrid");
  grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">⏳ Lagi ngambil menu...</div>`;
  try{
    const { data, error } = await sb.from("menu_items").select("*").eq("tersedia", true).order("cat").order("name");
    if(error) throw error;
    MENU = data || [];
    renderMenu();
  }catch(e){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">😵 Gagal load menu, refresh halaman ya.</div>`;
    console.error(e);
  }
}

/* ============================================================
   MENU RENDERING
   ============================================================ */
function renderMenu(){
  const grid = document.getElementById("menuGrid");
  const items = MENU.filter(m => activeCat==="semua" || m.cat===activeCat);
  if(items.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Belum ada menu nih 😅<br><small>Admin bisa tambah menu dulu ya</small></div>`;
    return;
  }
  grid.innerHTML = items.map(item=>{
    const qty = cart[item.id] || 0;
    const action = qty>0
      ? `<div class="stepper">
           <button onclick="changeQty('${item.id}',-1)" aria-label="Kurangi">−</button>
           <span>${qty}</span>
           <button onclick="changeQty('${item.id}',1)" aria-label="Tambah">+</button>
         </div>`
      : `<button class="add-btn" onclick="changeQty('${item.id}',1)">+ Tambah</button>`;
    const visual = item.image_url
      ? `<img class="card-img" src="${item.image_url}" alt="${item.name}" loading="lazy">`
      : `<div class="card-img-placeholder">${item.emoji||"🍽️"}</div>`;
    return `
      <div class="card">
        ${visual}
        <div class="card-body">
          <div class="card-cat">${item.cat}</div>
          <h3>${item.name}</h3>
          <div class="card-price">${rupiah(item.price)}</div>
          <div class="card-action">${action}</div>
        </div>
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
  const rekeningInfo = CONFIG.REKENING.map(r=>`   ${r.bank}: ${r.number} a.n. ${r.holder}`).join("\n");
  let msg = `Halo Warung GenZ! 👋\nMau konfirmasi pesanan:\n\nID Pesanan: ${order.id}\nNama: ${order.name}\nNo. HP: ${order.phone}\nAlamat/Catatan: ${order.address || "-"}\n\nPesanan:\n${lines}\n\nTOTAL: ${rupiah(order.total)}\nMetode Bayar: ${order.payment==="transfer" ? "Transfer Bank" : "COD"}\n\n`;
  if(order.payment==="transfer"){
    msg += `Saya sudah transfer ke salah satu rekening berikut:\n${rekeningInfo}\n\nBukti transfer saya lampirkan di chat ini ya 🙏`;
  } else {
    msg += "Mohon dikonfirmasi pesanannya, makasih! 🙏";
  }
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
    const rekeningHtml = CONFIG.REKENING.map(r=>`
      <div class="bank-box" style="margin-bottom:10px;">
        <div class="bname">${r.bank} a.n. ${r.holder}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="bnum" id="bnum-${r.bank}">${r.number}</div>
          <button onclick="copyRek('${r.number}','${r.bank}')"
            style="background:var(--ink);color:var(--turmeric);font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;flex-shrink:0;">
            📋 Salin
          </button>
        </div>
      </div>`).join("");
    bankBlock = `
      <p style="font-size:13px;font-weight:700;margin:14px 0 8px;">💳 Pilih rekening tujuan transfer:</p>
      ${rekeningHtml}
      <small style="color:#8a7c66;">Transfer sesuai total, lalu kirim bukti lewat tombol WhatsApp di bawah biar cepet diverifikasi 👇</small>`;
  }

  const stampText = order.payment==="transfer" ? "Menunggu Verifikasi" : "Menunggu Konfirmasi";

  document.getElementById("confirmBody").innerHTML = `
    <div class="stamp-wrap"><div class="stamp pending">${stampText}</div></div>
    <div class="mini-receipt">
      <div class="r"><span>ID Pesanan</span><span>${order.id}</span></div>
      ${itemLines}
      <div class="r tot"><span>TOTAL</span><span>${rupiah(order.total)}</span></div>
    </div>
    ${bankBlock}
    <a class="wa-btn" href="${waLink}" target="_blank" rel="noopener" style="margin-top:14px;">💬 Kirim Konfirmasi via WhatsApp</a>
    <button class="close-text-btn" onclick="closeConfirm()">Tutup, nanti aja konfirmasinya</button>
  `;
  document.getElementById("confirmModal").classList.add("show");
}

function copyRek(number, bank){
  navigator.clipboard.writeText(number).then(()=>{
    toast("No. rek " + bank + " berhasil disalin 📋");
  }).catch(()=>{
    toast("Salin manual ya: " + number);
  });
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
let adminMenuCache = [];

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

function adminLogout(){
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("adminGate").style.display = "block";
  document.getElementById("adminPin").value = "";
}

function switchAdminTab(tab){
  const isPesanan = tab==="pesanan";
  document.getElementById("adminTabPesanan").style.display = isPesanan ? "block" : "none";
  document.getElementById("adminTabMenu").style.display = isPesanan ? "none" : "block";
  document.getElementById("tabPesanan").classList.toggle("active", isPesanan);
  document.getElementById("tabMenu").classList.toggle("active", !isPesanan);
  if(tab==="menu") loadAdminMenuItems();
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

/* ---------- CRUD MENU ---------- */
async function loadAdminMenuItems(){
  const box = document.getElementById("adminMenuList");
  box.innerHTML = `<div class="empty-state">Lagi ambil data menu...</div>`;
  try{
    const { data, error } = await sb.from("menu_items").select("*").order("cat").order("name");
    if(error) throw error;
    adminMenuCache = data || [];
    renderAdminMenuList();
  }catch(e){
    box.innerHTML = `<div class="empty-state">Gagal ambil data menu.</div>`;
    console.error(e);
  }
}

function renderAdminMenuList(){
  const box = document.getElementById("adminMenuList");
  if(!adminMenuCache.length){
    box.innerHTML = `<div class="empty-state">Belum ada menu. Tambah dulu yuk!</div>`;
    return;
  }
  box.innerHTML = adminMenuCache.map(item=>`
    <div class="menu-item-card">
      ${item.image_url
        ? `<img class="mic-img" src="${item.image_url}" alt="${item.name}">`
        : `<div class="mic-emoji-fallback">${item.emoji||"🍽️"}</div>`}
      <div class="mic-info">
        <div class="mic-name">${item.name}</div>
        <div class="mic-sub">${item.cat} · ${item.tersedia ? "✅ Tersedia" : "❌ Tidak tersedia"}</div>
      </div>
      <span class="mic-price">${rupiah(item.price)}</span>
      <div class="mic-actions">
        <button class="edit-btn" onclick='startEditMenu(${JSON.stringify(item)})'>✏️ Edit</button>
        <button class="del-btn" onclick="deleteMenuItem('${item.id}','${item.name}')">🗑️</button>
      </div>
    </div>
  `).join("");
}

function previewImage(e){
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 2*1024*1024){ toast("Foto terlalu besar, maks 2MB ya bro!"); return; }
  const preview = document.getElementById("imgPreview");
  const label = document.getElementById("imgUploadLabel");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  label.style.display = "none";
}

function startEditMenu(item){
  document.getElementById("menuFormTitle").textContent = "✏️ Edit Menu";
  document.getElementById("editMenuId").value = item.id;
  document.getElementById("menuName").value = item.name;
  document.getElementById("menuCat").value = item.cat;
  document.getElementById("menuPrice").value = item.price;
  document.getElementById("menuEmoji").value = item.emoji||"";
  document.getElementById("cancelEditBtn").style.display = "inline-block";

  // tampilkan foto yang sudah ada di preview
  const preview = document.getElementById("imgPreview");
  const label = document.getElementById("imgUploadLabel");
  if(item.image_url){
    preview.src = item.image_url;
    preview.style.display = "block";
    label.style.display = "none";
  } else {
    preview.style.display = "none";
    label.style.display = "block";
  }
  document.getElementById("menuImageInput").value = "";
  window.scrollTo({top:0, behavior:"smooth"});
}

function cancelEditMenu(){
  document.getElementById("menuFormTitle").textContent = "➕ Tambah Menu Baru";
  document.getElementById("editMenuId").value = "";
  document.getElementById("menuName").value = "";
  document.getElementById("menuCat").value = "makanan";
  document.getElementById("menuPrice").value = "";
  document.getElementById("menuEmoji").value = "";
  document.getElementById("menuImageInput").value = "";
  document.getElementById("imgPreview").style.display = "none";
  document.getElementById("imgUploadLabel").style.display = "block";
  document.getElementById("cancelEditBtn").style.display = "none";
}

async function saveMenuItem(){
  const id = document.getElementById("editMenuId").value;
  const name = document.getElementById("menuName").value.trim();
  const cat = document.getElementById("menuCat").value;
  const price = parseInt(document.getElementById("menuPrice").value);
  const emoji = document.getElementById("menuEmoji").value.trim() || "🍽️";
  const fileInput = document.getElementById("menuImageInput");
  const file = fileInput.files[0];

  if(!name || !price || price<0){ toast("Lengkapin dulu nama & harga ya!"); return; }

  toast("⏳ Lagi nyimpen...");

  let image_url = null;

  // Upload foto kalau ada file baru yang dipilih
  if(file){
    const ext = file.name.split(".").pop();
    const filename = `menu-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from("menu-images").upload(filename, file, { upsert:true });
    if(upErr){ toast("Gagal upload foto: "+upErr.message); console.error(upErr); return; }
    const { data: urlData } = sb.storage.from("menu-images").getPublicUrl(filename);
    image_url = urlData.publicUrl;
  }

  // Kalau edit dan gak ada foto baru, pertahankan foto lama
  const payload = { name, cat, price, emoji, tersedia:true };
  if(image_url) payload.image_url = image_url;

  try{
    if(id){
      const { error } = await sb.from("menu_items").update(payload).eq("id", id);
      if(error) throw error;
      toast("Menu berhasil diupdate ✅");
    } else {
      const { error } = await sb.from("menu_items").insert(payload);
      if(error) throw error;
      toast("Menu baru berhasil ditambah ✅");
    }
    cancelEditMenu();
    await loadAdminMenuItems();
    await loadMenuFromDB();
  }catch(e){
    toast("Gagal simpan menu: "+e.message);
    console.error(e);
  }
}

async function deleteMenuItem(id, name){
  if(!confirm(`Hapus menu "${name}"? Aksi ini gak bisa dibatalin.`)) return;
  try{
    const { error } = await sb.from("menu_items").delete().eq("id", id);
    if(error) throw error;
    toast(`Menu "${name}" dihapus 🗑️`);
    await loadAdminMenuItems();
    await loadMenuFromDB();
  }catch(e){
    toast("Gagal hapus menu: "+e.message);
    console.error(e);
  }
}

/* ============================================================
   INIT
   ============================================================ */
(async function init(){
  renderCart();
  await loadMenuFromDB(); // load menu dari Supabase
})();
