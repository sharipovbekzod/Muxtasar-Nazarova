/***********************
 * FULL JS — Payment + Sheets + Upload + UX + Permissions fixes
 ***********************/

const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbwcTBRNffW52W41EHn6F4eA55ztqSRXAnqKe_X6hqrzqUEmeaoYwVdC0M6LVhyHRc1W/exec";

const CRM_URL = "https://superrustili2026.asosit.uz/lead";

// Oxirgi yuborilgan ma'lumotni saqlash uchun kalit
const LAST_SENT_KEY = "mfaktor_last_sent_payload_v1";

// ===== IndexedDB Helper (localStorage o'rniga katta fayllar uchun) =====
const PENDING_DB_NAME = "pendingSubmissionDB";
const PENDING_STORE = "submissions";
const PENDING_RECORD_KEY = "current";

function openPendingDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PENDING_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePendingSubmission(payload) {
  const db = await openPendingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).put(payload, PENDING_RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearPendingSubmission() {
  const db = await openPendingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).delete(PENDING_RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const formatUZS = (n) =>
  new Intl.NumberFormat("ru-RU").format(Number(n || 0)).replace(/,/g, " ") +
  " so'm";

const formatUSD = (n) => `$${Number(n || 0).toFixed(2)}`;

function safeJSONParse(str, fallback = {}) {
  try {
    return JSON.parse(str || "") ?? fallback;
  } catch {
    return fallback;
  }
}

function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Telegram|Instagram|FBAN|FBAV|Line|TikTok/i.test(ua);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
function isAndroid() {
  return /Android/i.test(navigator.userAgent || "");
}

function showInAppHintOnce() {
  if (!isInAppBrowser()) return;
  const KEY = "inapp_hint_shown_v1";
  if (sessionStorage.getItem(KEY)) return;

  sessionStorage.setItem(KEY, "1");
  console.warn(
    "In-app browser detected (Telegram/Instagram etc). File picker may be limited.",
  );

  setTimeout(() => {
    alert(
      "Agar rasm tanlash (galereya) ochilmasa:\n" +
        "⋮ (3 nuqta) → Open in Chrome/Safari qilib ochib ko‘ring.\n\n" +
        "Telegram/Instagram ichida ba’zan file picker cheklanadi.",
    );
  }, 400);
}

/**
 * ===== PERMISSIONS (Camera only) =====
 * ⚠️ Gallery/file picker uchun web'da permission prompt yo‘q.
 * Ammo kamera permission denied bo‘lsa userga settings yo‘lini ko‘rsatamiz.
 */
async function getCameraPermissionState() {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name: "camera" });
    return status.state || "unknown"; // granted | prompt | denied
  } catch {
    return "unknown";
  }
}

function showPermissionHelpUI() {
  const base =
    "Ruxsat berilmagan yoki cheklangan.\n\n" +
    "1) Agar Telegram/Instagram ichida ochilgan bo‘lsa, linkni Chrome/Safari’da oching.\n" +
    "2) Brauzer Settings → Site settings → Permissions dan ruxsatni yoqing.\n\n";

  if (isAndroid()) {
    alert(
      base +
        "Android/Chrome:\n" +
        "Settings → Apps → Chrome → Permissions → Files/Media va Camera → Allow\n" +
        "yoki Chrome: Site settings → Camera → Allow",
    );
  } else if (isiOS()) {
    alert(
      base +
        "iPhone/iPad:\n" +
        "Settings → Safari → Camera → Allow\n" +
        "va Photos ruxsatlari ham tekshiring",
    );
  } else {
    alert(base + "Kompyuterda: padlock icon → Site permissions → Allow");
  }
}

async function requestCameraPermission() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (e) {
    console.warn("Camera permission denied/failed:", e);
    return false;
  }
}

/**
 * Some devices / in-app browsers block file picker.
 * We can't force a permission prompt, but we can detect "no change"
 * and show a help message.
 */
async function openFilePickerWithFallback(fileInputEl) {
  return new Promise((resolve) => {
    let changed = false;

    const onChange = () => {
      changed = true;
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      fileInputEl.removeEventListener("change", onChange);
    };

    fileInputEl.addEventListener("change", onChange);

    // user gesture bo‘lishi kerak
    fileInputEl.click();

    // 1200ms ichida change bo‘lmasa:
    setTimeout(() => {
      if (!changed) {
        cleanup();

        // user cancel ham bo‘lishi mumkin — lekin in-app block bo‘lsa ko‘p uchraydi
        if (isInAppBrowser()) {
          alert(
            "Rasm tanlash oynasi ochilmasa, iltimos linkni Chrome/Safari’da oching.\n" +
              "Telegram/Instagram ichida bu funksiya cheklangan bo‘lishi mumkin.",
          );
        }
        resolve(false);
      }
    }, 1200);
  });
}

/***********************
 * 1) DOMContentLoaded — send formData to Sheets (dedupe)
 ***********************/
document.addEventListener("DOMContentLoaded", async function () {
  showInAppHintOnce();

  try {
    const storedData = localStorage.getItem("formData");
    if (!storedData) return;

    const data = safeJSONParse(storedData, {});
    if (!data.timestamp) return;

    const date = new Date(data.timestamp);

    const formattedDate = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
      date.getDate(),
    ).padStart(2, "0")}.${date.getFullYear()} ${String(
      date.getHours(),
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

    // fingerprint (timestamp qo'shilmaydi)
    const currentPayloadFingerprint = JSON.stringify({
      name: data.name,
      phone: data.phone_number,
      tarif: data.type || "STANDART",
      offerta: data.offerta || "TANISHDIM",
      english_level: data.english_level || "",
      speaking_level: data.speaking_level || "",
    });

    const lastSentFingerprint = localStorage.getItem(LAST_SENT_KEY);

    if (
      lastSentFingerprint &&
      lastSentFingerprint === currentPayloadFingerprint
    ) {
      console.log(
        "Aynan shu ma'lumot allaqachon yuborilgan, yana yubormayman.",
      );
      return;
    }

    const formData = new FormData();
    formData.append("Ism", data.name || "");
    formData.append("Telefon raqam", data.phone_number || "");
    formData.append("Tarif", data.type || "");
    formData.append("Telegram", data.telegram);
    formData.append("Sana", formattedDate);
    formData.append("imageUpload", "false");
    formData.append("sheetName", "Royhatdan otganlar");
    formData.append("Offerta", data.offerta || "");

    // Sheets va CRM ga bir vaqtda yuborish
    const sheetPromise = fetch(SHEET_URL, { method: "POST", body: formData });

    const crmPromise = fetch(CRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name || "",
        phone: data.phone_number || "",
      }),
    });

    const [sheetRes, crmRes] = await Promise.all([
      sheetPromise.catch((e) => {
        console.error("❌ Sheets yuborishda xatolik:", e);
        return null;
      }),
      crmPromise.catch((e) => {
        console.error("❌ CRM yuborishda xatolik:", e);
        return null;
      }),
    ]);

    if (sheetRes?.ok) {
      console.log("✅ Sheets ga ma'lumot yuborildi");
      localStorage.setItem(LAST_SENT_KEY, currentPayloadFingerprint);
    } else if (sheetRes) {
      console.error(
        "❌ Sheets yuborishda xatolik:",
        sheetRes.status,
        sheetRes.statusText,
      );
    }

    if (crmRes?.ok) {
      const crmData = await crmRes.json().catch(() => ({}));
      console.log("✅ CRM ga lead yuborildi:", crmData);
    } else if (crmRes) {
      const crmError = await crmRes.json().catch(() => ({}));
      console.warn("⚠️ CRM javob:", crmRes.status, crmError);
    }
  } catch (error) {
    console.error("Network error:", error);
  }
});

/***********************
 * 2) Tarif / narxlar
 ***********************/
const localData = safeJSONParse(localStorage.getItem("formData"), {});

const TARIFFS = {
  standart: { label: "Standart", uzs: 1_297_000 },
  premium: { label: "Premium", uzs: 1_397_000 },
  vip: { label: "VIP", uzs: 7_297_000 },
  // booking: { label: "Bron", uzs: 500_000 }, // kerak bo’lsa och
};

const typeKey = String(localData.type || "premium")
  .trim()
  .toLowerCase();
const selectedTariff = TARIFFS[typeKey] ?? TARIFFS.premium;

const paymentTariffEl = $(".payment__tariff");
const pricesAllEls = $$(".pricesAll");
const priceUSDEl = $(".priceUSD");

const bookingUZSEl = $(".bookingPriceUZS");
const bookingUSDEl = $(".bookingPriceUSD");

if (paymentTariffEl)
  paymentTariffEl.innerHTML = `Tarif: ${selectedTariff.label}`;
pricesAllEls.forEach((el) => (el.innerHTML = formatUZS(selectedTariff.uzs)));

if (bookingUZSEl && TARIFFS.booking)
  bookingUZSEl.innerHTML = formatUZS(TARIFFS.booking.uzs);

(async () => {
  const rate = await getUZSToUSDRate();
  if (!rate) return;

  const usd = selectedTariff.uzs * rate;
  if (priceUSDEl) priceUSDEl.innerHTML = formatUSD(usd);

  if (bookingUSDEl && TARIFFS.booking) {
    bookingUSDEl.innerHTML = formatUSD(TARIFFS.booking.uzs * rate);
  }
})();

async function getUZSToUSDRate() {
  const CACHE_KEY = "uzs_usd_rate_cache_v1";
  const TTL_MS = 30 * 60 * 1000;

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { rate, ts } = safeJSONParse(cached, {});
      if (rate && ts && Date.now() - ts < TTL_MS) return rate;
    }

    const res = await fetch(
      "https://v6.exchangerate-api.com/v6/d724f66af3d5a151bdcd1d40/latest/UZS",
    );
    const data = await res.json();

    const rate = data?.conversion_rates?.USD;
    if (!rate) return null;

    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
    return rate;
  } catch (e) {
    console.error("Valyuta kursini olishda xatolik:", e);
    return null;
  }
}

/***********************
 * 3) Upload UI — file picker + permissions flow
 ***********************/
const fileInput = document.getElementById("chek");
const uploadLabel = document.querySelector(".uploadCheck");
const openPickerBtn = document.querySelector(".uploadCheckBtn");

// ixtiyoriy: user o‘zi bosib camera permissionni yoqishi uchun
const openCameraBtn = document.querySelector(".openCameraBtn");

const originalUploadHTML = uploadLabel?.innerHTML || "";

function resetUploadLabel() {
  if (!uploadLabel) return;
  uploadLabel.innerHTML =
    originalUploadHTML ||
    `
    <svg xmlns="http://www.w3.org/2000/svg" width="54" height="66" viewBox="0 0 54 66">
      <g><path d="M 3.86 63.09 C1.51,61.19 1.50,61.08 1.17,35.84 C0.80,8.16 1.33,4.08 5.54,2.16 C7.05,1.47 13.26,1.00 20.80,1.00 L 33.52 1.00 L 43.26 10.29 L 53.00 19.59 L 53.00 40.29 C53.00,59.67 52.87,61.13 51.00,63.00 C49.12,64.88 47.67,65.00 27.61,65.00 C8.05,65.00 6.02,64.84 3.86,63.09 Z" fill="rgba(0,0,0,1)"/></g>
    </svg>
    Chek rasmini yuklash uchun bu yerga bosing
  `;
}

function setUploadFileName(name) {
  if (!uploadLabel) return;
  uploadLabel.innerHTML = `
  <?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg width="54px" height="54px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="#1C274C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 3.33782C8.47087 2.48697 10.1786 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 10.1786 2.48697 8.47087 3.33782 7" stroke="#1C274C" stroke-width="1.5" stroke-linecap="round"/>
</svg>
    ${name}
  `;
}

// Camera permission button (optional)
if (openCameraBtn) {
  openCameraBtn.addEventListener("click", async () => {
    const state = await getCameraPermissionState();
    if (state === "denied") {
      showPermissionHelpUI();
      return;
    }
    const ok = await requestCameraPermission();
    if (!ok) showPermissionHelpUI();
  });
}

// ✅ Open file picker ONLY from user click
if (openPickerBtn && fileInput) {
  openPickerBtn.addEventListener("click", async () => {
    // 1) in-app hint already shown
    // 2) camera permission check (only helps if user uses camera capture)
    const camState = await getCameraPermissionState();

    // agar denied bo‘lsa, “permission” yordam UI
    // (bu gallery emas, lekin ko‘p userlarda shu ham muammo bo‘ladi)
    if (camState === "denied") {
      showPermissionHelpUI();
      // baribir gallery ochib ko‘ramiz:
    }

    await openFilePickerWithFallback(fileInput);
  });
}

// When file selected
if (fileInput) {
  fileInput.addEventListener("change", function () {
    const file = this.files?.[0];
    if (!file) {
      resetUploadLabel();
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Fayl hajmi 10MB dan kichik bo‘lishi kerak");
      this.value = "";
      resetUploadLabel();
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      alert("Faqat PNG, JPG yoki PDF fayllarni yuklash mumkin");
      this.value = "";
      resetUploadLabel();
      return;
    }

    setUploadFileName(file.name);
  });
}

/***********************
 * 4) Submit — base64 upload to GAS
 ***********************/
const paymentForm = document.getElementById("paymentForm");

if (paymentForm) {
  paymentForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitButton = this.querySelector(".payment__btn");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Yuborilmoqda...";
    }

    try {
      const localData = safeJSONParse(localStorage.getItem("formData"), {});
      if (!localData.name || !localData.phone_number) {
        alert(
          "Ism yoki telefon raqami topilmadi. Iltimos, formani to‘ldiring.",
        );
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Davom etish";
        }
        return;
      }

      const form = new FormData(this);
      const paymentType = String(form.get("status") || "");
      const file = form.get("chek");

      if (!file || !file.size) {
        alert("Chek rasmini yuklang");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Davom etish";
        }
        return;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert("Fayl hajmi 10MB dan kichik bo‘lishi kerak");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Davom etish";
        }
        return;
      }

      const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        alert("Faqat PNG, JPG yoki PDF fayllarni yuklash mumkin");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Davom etish";
        }
        return;
      }

      // update localStorage meta
      const updatedLocalData = {
        ...localData,
        payment_type: paymentType,
        file_name: file.name,
        last_submitted: new Date().toISOString(),
      };
      localStorage.setItem("formData", JSON.stringify(updatedLocalData));

      // convert file to base64
      const toBase64 = (f) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || "");
            const commaIndex = result.indexOf(",");
            const b64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
            resolve({ b64, mime: f.type });
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });

      const { b64, mime } = await toBase64(file);

      const payload = {
        sheetName: "Chek Yuborganlar",
        imageUpload: "true",
        checkUrlHeader: "Check URL",
        Ism: String(localData.name || ""),
        "Telefon raqam": String(localData.phone_number || ""),
        Tarif: String(localData.type || ""),
        Status: paymentType,
        file_data: b64,
        file_filename: file.name,
        file_mime: mime,
        createdAt: new Date().toISOString(),
        Offerta: String(localData.offerta || ""),
        "Telegram": localData.telegram,
      };

      await savePendingSubmission(payload);

      // Chek base64 ko'rinishida katta bo'lishi mumkin. sendBeacon bunday
      // payloadni (odatda ~64 KB dan kattasini) yubormasdan false qaytaradi.
      // Shuning uchun redirectdan avval serverning aniq javobini kutamiz.
      const response = await fetch(SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.result !== "success") {
        throw new Error(
          result.error || `Server xatosi: ${response.status || "noma'lum"}`,
        );
      }

      await clearPendingSubmission();
      // Reset UI + redirect
      this.reset();
      resetUploadLabel();
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Davom etish";
      }
      window.location.href = "./thankYou.html";
    } catch (err) {
      console.error("Submit error:", err);
      alert(
        `Xato yuz berdi: ${err?.message || err}. Iltimos, keyinroq qayta urinib ko‘ring.`,
      );
      const submitButton2 = document.querySelector(".payment__btn");
      if (submitButton2) {
        submitButton2.disabled = false;
        submitButton2.textContent = "Davom etish";
      }
    }
  });
}
/***********************
 * 5) Timer (20:00)
 ***********************/
let timerElement = document.getElementById("timer");
let minutes = 20;
let seconds = 0;

function updateTimer() {
  if (!timerElement) return;
  if (seconds === 0) {
    if (minutes === 0) {
      clearInterval(timerInterval);
      timerElement.innerText = "00:00";
      return;
    }
    minutes--;
    seconds = 59;
  } else {
    seconds--;
  }
  const minStr = minutes < 10 ? "0" + minutes : String(minutes);
  const secStr = seconds < 10 ? "0" + seconds : String(seconds);
  timerElement.innerText = `${minStr}:${secStr}`;
}

let timerInterval = setInterval(updateTimer, 1000);

/***********************
 * 6) Copy card number + tick
 ***********************/
$$(".copy").forEach((btn) => {
  const originalSVG = btn.innerHTML;

  const tickSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2F80EC" class="size-8">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  `;

  btn.addEventListener("click", async () => {
    try {
      const cardNumber = btn
        .closest(".payment__card")
        ?.querySelector(".payment__card-number")
        ?.textContent?.trim();

      if (!cardNumber) {
        alert("Karta raqami topilmadi");
        return;
      }

      await navigator.clipboard.writeText(cardNumber);

      btn.innerHTML = tickSVG;
      setTimeout(() => (btn.innerHTML = originalSVG), 1500);
    } catch (err) {
      alert("Nusxalashda xatolik yuz berdi!");
      console.error(err);
    }
  });
});
