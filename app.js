
// Mythos Quotes PWA (patched)
const PAYPAL_CONFIG = {
  subscriptionLink: "https://www.paypal.com/ncp/payment/YOUR_SUBSCRIPTION_ID",
  oneOffMerchLink: "https://www.paypal.com/ncp/payment/YOUR_ONE_OFF_ID"
};

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

function haptic(type="tap") {
  if (!("vibrate" in navigator)) return;
  const patterns = { tap:[10], click:[15], success:[20,30,20], special:[60,30,60,30,80], error:[100,30,100] };
  navigator.vibrate(patterns[type] || [10]);
}

// DOM
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

// Router
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(tab.dataset.view).classList.add("active");
    haptic("tap");
  });
});

// A2HS / Install
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  maybeShowInstallToast();
});

function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isInStandaloneMode(){
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}

function maybeShowInstallToast(){
  const shown = localStorage.getItem(STORAGE_KEYS.A2HS_SHOWN);
  if (shown) return;
  installToast.hidden = false;
  localStorage.setItem(STORAGE_KEYS.A2HS_SHOWN,"1");
}

function openIosHelp(){
  installToast.hidden = true;
  iosHelp.hidden = false;
  document.body.classList.add("modal-open");
}
function closeIos(){
  iosHelp.hidden = true;
  document.body.classList.remove("modal-open");
}

installNow.addEventListener("click", async () => {
  haptic("click");
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  } else if (isIOS() && !isInStandaloneMode()) {
    openIosHelp();
  }
  installToast.hidden = true;
});
howToInstall.addEventListener("click", () => {
  haptic("tap");
  if (isIOS()) openIosHelp();
  else alert("On Android/Chrome: open menu → Install app.\nOn desktop Chrome/Edge: use the install icon in the address bar.");
});
dismissInstall.addEventListener("click", () => { haptic("tap"); installToast.hidden = true; });
installBtn.addEventListener("click", () => { haptic("tap"); maybeShowInstallToast(); });

closeIosHelp.addEventListener("click", () => { haptic("tap"); closeIos(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !iosHelp.hidden) closeIos(); });

// SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

// Quotes
async function fetchQuotes(){ const r = await fetch("quotes.json"); if(!r.ok) throw new Error("load quotes"); return r.json(); }
function pickDaily(quotes){
  const d=new Date(); const key=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
  return quotes[key % quotes.length];
}
function updateStreak(){
  const today = new Date().toDateString();
  const last = localStorage.getItem(STORAGE_KEYS.LAST_DAY);
  let s = parseInt(localStorage.getItem(STORAGE_KEYS.STREAK)||"0",10);
  if (last !== today){
    const y = new Date(Date.now()-86400000).toDateString();
    s = (last===y)? s+1 : 1;
    localStorage.setItem(STORAGE_KEYS.LAST_DAY, today);
    localStorage.setItem(STORAGE_KEYS.STREAK, String(s));
  }
  streakEl.textContent = `Streak: ${s} ${s%7===0? "Blessing: +1 Relic Sigil!" : ""}`;
}
function renderQuote(q){
  currentQuote = q;
  document.querySelector(".quote-text").textContent = q.text;
  document.querySelector(".quote-author").textContent = "— " + q.author;
  document.querySelector(".quote-actions").hidden = false;
  haptic(q.special? "special":"success");
  if (q.special){
    const qb=document.getElementById("quoteBox");
    qb.style.boxShadow="0 0 0 3px rgba(154,123,255,.45) inset, 0 0 36px rgba(154,123,255,.25)";
    setTimeout(()=> qb.style.boxShadow="",1200);
  }
}

// Vault
const STORAGE = {
  get vault(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEYS.VAULT)||"[]");}catch{return[];} },
  set vault(v){ localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(v)); },
  get subscribed(){ return localStorage.getItem(STORAGE_KEYS.SUBSCRIBED)==="1"; },
  set subscribed(v){ localStorage.setItem(STORAGE_KEYS.SUBSCRIBED, v?"1":"0"); }
};
function renderVault(){
  const v = STORAGE.vault; const list = document.getElementById("vaultList");
  list.innerHTML = "";
  if (!v.length){
    const li=document.createElement("li");
    li.innerHTML="<div class='subtle'>Nothing here yet. Save a quote from the Oracle.</div>";
    list.appendChild(li); return;
  }
  v.forEach((q,i)=>{
    const li=document.createElement("li");
    li.innerHTML = `
      <div class="v-quote">“${q.text}” <span class="subtle">— ${q.author}</span></div>
      <div class="vault-actions">
        <button class="button" data-act="use" data-idx="${i}">Use in Forge</button>
        <button class="button" data-act="share" data-idx="${i}">Share</button>
        <button class="button" data-act="del" data-idx="${i}">Delete</button>
      </div>`;
    list.appendChild(li);
  });
}
vaultList.addEventListener("click",(e)=>{
  const btn=e.target.closest("button"); if(!btn) return;
  const act=btn.dataset.act; const i=parseInt(btn.dataset.idx,10);
  const v=STORAGE.vault; const q=v[i];
  if(act==="use"){
    document.getElementById("forgeQuote").value = `“${q.text}”\n— ${q.author}`;
    haptic("tap"); document.querySelector('.tab[data-view="forge"]').click();
  }
  if(act==="share"){ shareQuote(q); }
  if(act==="del"){ v.splice(i,1); STORAGE.vault=v; renderVault(); haptic("error"); }
});
function saveCurrentQuote(){
  if(!currentQuote) return;
  const v = STORAGE.vault;
  if (v.find(x=>x.text===currentQuote.text && x.author===currentQuote.author)) return alert("Already in your Vault.");
  if (!STORAGE.subscribed && v.length >= LIMIT_FREE_VAULT) return alert("Vault limit reached on Free. Subscribe to unlock unlimited saves.");
  v.unshift(currentQuote); STORAGE.vault=v; renderVault(); alert("Saved to Vault.");
}

// Share
function shareQuote(q){
  const text = `“${q.text}” — ${q.author} #MythosQuotes`;
  if (navigator.share) navigator.share({text}).catch(()=>{});
  else navigator.clipboard.writeText(text).then(()=>alert("Copied to clipboard!"));
}

// Events
document.getElementById("summonBtn").addEventListener("click", async ()=>{
  haptic("click");
  const ring=document.querySelector(".rune-ring"); ring.style.filter="drop-shadow(0 0 20px rgba(232,198,98,.6))";
  setTimeout(()=> ring.style.filter="",800);
  try{
    const list = await fetchQuotes(); renderQuote(pickDaily(list)); updateStreak();
  } catch{
    alert("Failed to summon quotes. Try again later or offline; the PWA caches content.");
  }
});
randomBtn.addEventListener("click", async ()=>{
  haptic("tap"); const list=await fetchQuotes();
  renderQuote(list[Math.floor(Math.random()*list.length)]);
});
saveBtn.addEventListener("click", saveCurrentQuote);
shareBtn.addEventListener("click", ()=> currentQuote && shareQuote(currentQuote));
specialBtn.addEventListener("click", ()=>{
  if(!currentQuote) return;
  haptic("special"); alert("Special inscription adds rare gilded styling in your export.");
  document.getElementById("forgeQuote").value = `“${currentQuote.text}”\n— ${currentQuote.author}`;
  document.querySelector('.tab[data-view="forge"]').click();
});

// Forge overlays
function applyOverlay(el){
  const txt = (document.getElementById("forgeQuote").value.trim()) || (currentQuote? `“${currentQuote.text}”\n— ${currentQuote.author}` : "");
  el.style.setProperty("--size", fontSize.value + "px");
  el.style.setProperty("--align", textAlign.value);
  el.setAttribute("data-text", txt);
  haptic("tap");
}
applyToMug.addEventListener("click", ()=> applyOverlay(mugOverlay));
applyToShirt.addEventListener("click", ()=> applyOverlay(shirtOverlay));

downloadPNG.addEventListener("click", ()=>{
  const canvas=exportCanvas, ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="rgba(255,255,255,0)"; ctx.fillRect(0,0,canvas.width,canvas.height);
  const lines=(forgeQuote.value || (currentQuote? `“${currentQuote.text}”\n— ${currentQuote.author}` : "Your quote here")).split("\n");
  const size=parseInt(fontSize.value,10)*3; ctx.font=`${size}px Cinzel, serif`; ctx.fillStyle="#111"; ctx.textAlign=textAlign.value;
  const x = textAlign.value==="left"? 200 : (textAlign.value==="right"? canvas.width-200 : canvas.width/2);
  let y=400; for(const line of lines){ ctx.fillText(line,x,y); y+=size*1.25; }
  const a=document.createElement("a"); a.download="mythos-quote.png"; a.href=canvas.toDataURL("image/png"); a.click();
  haptic("success");
});

// Subscribe (placeholder)
subscribeBtn.addEventListener("click", ()=>{
  haptic("click");
  if (!PAYPAL_CONFIG.subscriptionLink.includes("YOUR_SUBSCRIPTION_ID")){
    window.open(PAYPAL_CONFIG.subscriptionLink,"_blank");
    localStorage.setItem(STORAGE_KEYS.SUBSCRIBED,"1");
    alert("Thanks! Perks unlocked.");
  } else alert("Configure your PayPal link in app.js (PAYPAL_CONFIG.subscriptionLink).");
});

// Init
renderVault(); updateStreak();
mugOverlay.style.setProperty("--size","42px"); mugOverlay.style.setProperty("--align","center");
shirtOverlay.style.setProperty("--size","42px"); shirtOverlay.style.setProperty("--align","center");
