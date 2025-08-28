
// Mythos Quotes PWA
// Configurable PayPal & Provider links (fill these with your live links later).
const PAYPAL_CONFIG = {
  subscriptionLink: "https://www.paypal.com/ncp/payment/YOUR_SUBSCRIPTION_ID", // TODO: replace
  oneOffMerchLink: "https://www.paypal.com/ncp/payment/YOUR_ONE_OFF_ID" // optional
};

// Basic feature flags
const LIMIT_FREE_VAULT = 10;
const STORAGE_KEYS = {
  VAULT: "mythos_vault",
  STREAK: "mythos_streak",
  LAST_DAY: "mythos_last_day",
  SUBSCRIBED: "mythos_subscribed",
  A2HS_SHOWN: "mythos_a2hs_shown"
};

let deferredPrompt = null;
let currentQuote = null;

// Haptics helpers
function haptic(type="tap") {
  if (!("vibrate" in navigator)) return;
  const patterns = {
    tap: [10],
    click: [15],
    success: [20, 30, 20],
    special: [60, 30, 60, 30, 80],
    error: [100, 30, 100]
  };
  navigator.vibrate(patterns[type] || [10]);
}

// Select elements
const views = document.getElementById("views");
const tabs = document.querySelectorAll(".tab");
const summonBtn = document.getElementById("summonBtn");
const saveBtn = document.getElementById("saveBtn");
const shareBtn = document.getElementById("shareBtn");
const specialBtn = document.getElementById("specialBtn");
const quoteBox = document.getElementById("quoteBox");
const streakEl = document.getElementById("streak");
const vaultList = document.getElementById("vaultList");

const forgeQuote = document.getElementById("forgeQuote");
const fontSize = document.getElementById("fontSize");
const textAlign = document.getElementById("textAlign");
const applyToMug = document.getElementById("applyToMug");
const applyToShirt = document.getElementById("applyToShirt");
const downloadPNG = document.getElementById("downloadPNG");
const mugOverlay = document.getElementById("mugOverlay");
const shirtOverlay = document.getElementById("shirtOverlay");
const exportCanvas = document.getElementById("exportCanvas");

const subscribeBtn = document.getElementById("subscribeBtn");

const installToast = document.getElementById("installToast");
const installNow = document.getElementById("installNow");
const howToInstall = document.getElementById("howToInstall");
const dismissInstall = document.getElementById("dismissInstall");
const installBtn = document.getElementById("installBtn");
const iosHelp = document.getElementById("iosHelp");
const closeIosHelp = document.getElementById("closeIosHelp");
const randomBtn = document.getElementById("randomBtn");

// Simple router
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(tab.dataset.view).classList.add("active");
    haptic("tap");
  });
});

// A2HS / Install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  maybeShowInstallToast();
});

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
function isInStandaloneMode() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}

function maybeShowInstallToast() {
  const shown = localStorage.getItem(STORAGE_KEYS.A2HS_SHOWN);
  if (shown) return;
  // Show our fancy prompt on first open
  installToast.hidden = false;
  localStorage.setItem(STORAGE_KEYS.A2HS_SHOWN, "1");
}

installNow.addEventListener("click", async () => {
  haptic("click");
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
  } else if (isIOS() && !isInStandaloneMode()) {
    iosHelp.hidden = false;
  }
  installToast.hidden = true;
});

howToInstall.addEventListener("click", () => {
  haptic("tap");
  if (isIOS()) iosHelp.hidden = false;
  else alert("On Android/Chrome: open menu → Install app.\nOn desktop Chrome/Edge: install icon in the address bar.");
});

dismissInstall.addEventListener("click", () => {
  haptic("tap");
  installToast.hidden = true;
});

installBtn.addEventListener("click", () => {
  haptic("tap");
  maybeShowInstallToast();
});
closeIosHelp.addEventListener("click", () => iosHelp.hidden = true);

// Register SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

// Fetch quotes
async function fetchQuotes() {
  const res = await fetch("quotes.json");
  if (!res.ok) throw new Error("Failed to load quotes");
  return res.json();
}

// Deterministic daily pick based on date
function pickDaily(quotes) {
  const d = new Date();
  const key = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
  const idx = key % quotes.length;
  return quotes[idx];
}

// Streak logic
function updateStreak() {
  const today = new Date().toDateString();
  const lastDay = localStorage.getItem(STORAGE_KEYS.LAST_DAY);
  let streak = parseInt(localStorage.getItem(STORAGE_KEYS.STREAK) || "0", 10);
  if (lastDay === today) {
    // already counted today
  } else {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDay === yesterday) streak += 1;
    else streak = 1;
    localStorage.setItem(STORAGE_KEYS.LAST_DAY, today);
    localStorage.setItem(STORAGE_KEYS.STREAK, String(streak));
  }
  const blessing = (streak % 7 === 0) ? "Blessing: +1 Relic Sigil!" : "";
  streakEl.textContent = `Streak: ${streak} ${blessing}`;
}

// Render quote
function renderQuote(q) {
  currentQuote = q;
  const qText = document.querySelector(".quote-text");
  const qAuth = document.querySelector(".quote-author");
  qText.textContent = q.text;
  qAuth.textContent = "— " + q.author;
  document.querySelector(".quote-actions").hidden = false;
  // haptics: stronger for special quotes
  haptic(q.special ? "special" : "success");
  // glow pulse for special
  if (q.special) {
    quoteBox.style.boxShadow = "0 0 0 3px rgba(154,123,255,.45) inset, 0 0 36px rgba(154,123,255,.25)";
    setTimeout(()=> quoteBox.style.boxShadow = "", 1200);
  }
}

// Save to vault with subscription gate
function getVault() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.VAULT) || "[]"); }
  catch { return []; }
}
function setVault(v) {
  localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(v));
}
function isSubscribed() {
  return localStorage.getItem(STORAGE_KEYS.SUBSCRIBED) === "1";
}

function saveCurrentQuote() {
  if (!currentQuote) return;
  const vault = getVault();
  const exists = vault.find(v => v.text === currentQuote.text && v.author === currentQuote.author);
  if (exists) { alert("Already in your Vault."); return; }
  if (!isSubscribed() && vault.length >= LIMIT_FREE_VAULT) {
    alert("Vault limit reached on Free. Subscribe to unlock unlimited saves.");
    return;
  }
  vault.unshift(currentQuote);
  setVault(vault);
  renderVault();
  alert("Saved to Vault.");
}

function renderVault() {
  const vault = getVault();
  vaultList.innerHTML = "";
  if (!vault.length) {
    const li = document.createElement("li");
    li.innerHTML = "<div class='subtle'>Nothing here yet. Save a quote from the Oracle.</div>";
    vaultList.appendChild(li);
    return;
  }
  vault.forEach((q, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="v-quote">“${q.text}” <span class="subtle">— ${q.author}</span></div>
      <div class="vault-actions">
        <button class="button" data-act="use" data-idx="${idx}">Use in Forge</button>
        <button class="button" data-act="share" data-idx="${idx}">Share</button>
        <button class="button" data-act="del" data-idx="${idx}">Delete</button>
      </div>
    `;
    vaultList.appendChild(li);
  });
}

// Vault buttons
vaultList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  const act = btn.dataset.act;
  const vault = getVault();
  const q = vault[idx];
  if (act === "use") {
    forgeQuote.value = q.text + "\\n— " + q.author;
    haptic("tap");
    // switch to Forge view
    document.querySelector('.tab[data-view="forge"]').click();
  } else if (act === "share") {
    shareQuote(q);
  } else if (act === "del") {
    vault.splice(idx, 1);
    setVault(vault);
    renderVault();
    haptic("error");
  }
});

// Sharing
function shareQuote(q) {
  const text = `“${q.text}” — ${q.author} #MythosQuotes`;
  if (navigator.share) {
    navigator.share({ text }).catch(()=>{});
  } else {
    navigator.clipboard.writeText(text).then(()=> alert("Copied to clipboard!"));
  }
}

// Events
summonBtn.addEventListener("click", async () => {
  haptic("click");
  // rune animation flourish
  const ring = document.querySelector(".rune-ring");
  ring.style.filter = "drop-shadow(0 0 20px rgba(232,198,98,.6))";
  setTimeout(()=> ring.style.filter = "", 800);
  try {
    const list = await fetchQuotes();
    const q = pickDaily(list);
    renderQuote(q);
    updateStreak();
  } catch (e) {
    alert("Failed to summon quotes. Try again offline later; the PWA caches content.");
  }
});

randomBtn.addEventListener("click", async () => {
  haptic("tap");
  const list = await fetchQuotes();
  const q = list[Math.floor(Math.random()*list.length)];
  renderQuote(q);
});

saveBtn.addEventListener("click", saveCurrentQuote);
shareBtn.addEventListener("click", () => currentQuote && shareQuote(currentQuote));
specialBtn.addEventListener("click", () => {
  if (!currentQuote) return;
  haptic("special");
  alert("Special inscription adds rare gilded styling in your export.");
  forgeQuote.value = `“${currentQuote.text}”\\n— ${currentQuote.author}`;
  document.querySelector('.tab[data-view="forge"]').click();
});

// Forge overlays
function applyOverlay(targetEl) {
  const txt = forgeQuote.value.trim() || (currentQuote ? `“${currentQuote.text}”\\n— ${currentQuote.author}` : "");
  targetEl.style.setProperty("--size", fontSize.value + "px");
  targetEl.style.setProperty("--align", textAlign.value);
  targetEl.setAttribute("data-text", txt);
  haptic("tap");
}
applyToMug.addEventListener("click", () => applyOverlay(mugOverlay));
applyToShirt.addEventListener("click", () => applyOverlay(shirtOverlay));

// Export PNG for print providers (e.g., Printify)
downloadPNG.addEventListener("click", () => {
  const canvas = exportCanvas;
  const ctx = canvas.getContext("2d");
  // background transparent for better print
  ctx.clearRect(0,0,canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0)";
  ctx.fillRect(0,0,canvas.width, canvas.height);

  const lines = (forgeQuote.value || (currentQuote ? `“${currentQuote.text}”\\n— ${currentQuote.author}` : "Your quote here")).split("\\n");
  const size = parseInt(fontSize.value, 10) * 3; // upscale for print
  ctx.font = `${size}px Cinzel, serif`;
  ctx.fillStyle = "#111";
  ctx.textAlign = textAlign.value;

  const x = textAlign.value === "left" ? 200 : (textAlign.value === "right" ? canvas.width-200 : canvas.width/2);
  let y = 400;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += size * 1.25;
  }

  const link = document.createElement("a");
  link.download = "mythos-quote.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  haptic("success");
});

// Subscription (placeholder PayPal link)
subscribeBtn.addEventListener("click", () => {
  haptic("click");
  if (!PAYPAL_CONFIG.subscriptionLink.includes("YOUR_SUBSCRIPTION_ID")) {
    window.open(PAYPAL_CONFIG.subscriptionLink, "_blank");
    // Optimistic unlock; in real life you'd verify via webhook/login
    localStorage.setItem(STORAGE_KEYS.SUBSCRIBED, "1");
    alert("Thanks! Perks unlocked.");
  } else {
    alert("Configure your PayPal link in app.js (PAYPAL_CONFIG.subscriptionLink).");
  }
});

// On load
renderVault();
updateStreak();

// CSS variables for overlays
mugOverlay.style.setProperty("--size", "42px");
mugOverlay.style.setProperty("--align", "center");
shirtOverlay.style.setProperty("--size", "42px");
shirtOverlay.style.setProperty("--align", "center");
