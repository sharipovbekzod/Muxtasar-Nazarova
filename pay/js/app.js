!(function () {
  // ----------------- Davlatlar ro'yxati -----------------
  const COUNTRIES = [
    { name: "Oʻzbekiston", code: "+998", pattern: "## ###-##-##" },
    { name: "Rossiya", code: "+7", pattern: "### ###-##-##" },
    { name: "Qozogʻiston", code: "+7", pattern: "### ###-##-##" },
    { name: "Qirgʻiziston", code: "+996", pattern: "### ###-###" },
    { name: "Tojikiston", code: "+992", pattern: "###-###-###" },
    { name: "Turkmaniston", code: "+993", pattern: "## ###-##-##" },
    { name: "Armaniston", code: "+374", pattern: "## ###-###" },
    { name: "Gruziya", code: "+995", pattern: "### ###-###" },
    { name: "Ukraina", code: "+380", pattern: "## ###-##-##" },
    { name: "Belarus", code: "+375", pattern: "## ###-##-##" },
    { name: "Xitoy", code: "+86", pattern: "### #### ####" },
    { name: "Janubiy Koreya", code: "+82", pattern: "##-####-####" },
    { name: "Turkiya", code: "+90", pattern: "### ### ####" },
    { name: "Hindiston", code: "+91", pattern: "#####-#####" },
    { name: "Yaponiya", code: "+81", pattern: "##-####-####" },
    { name: "Malayziya", code: "+60", pattern: "##-### ####" },
    { name: "Indoneziya", code: "+62", pattern: "###-####-####" },
    { name: "Vyetnam", code: "+84", pattern: "###-####-###" },
    { name: "Filippin", code: "+63", pattern: "### ### ####" },
    { name: "BAA", code: "+971", pattern: "## ### ####" },
    { name: "Saudiya Arabistoni", code: "+966", pattern: "# ### ####" },
    { name: "Qatar", code: "+974", pattern: "#### ####" },
    { name: "Ummon", code: "+968", pattern: "#### ####" },
    { name: "Quvayt", code: "+965", pattern: "#### ####" },
    { name: "Misr", code: "+20", pattern: "## ### ####" },
    { name: "Buyuk Britaniya", code: "+44", pattern: "(##) #### ####" },
    { name: "Germaniya", code: "+49", pattern: "(##) #### ####" },
    { name: "Fransiya", code: "+33", pattern: "## ## ## ## ##" },
    { name: "Italiya", code: "+39", pattern: "## #### ####" },
    { name: "Ispaniya", code: "+34", pattern: "## ### ###" },
    { name: "Shveytsariya", code: "+41", pattern: "## ### ## ##" },
    { name: "AQSh", code: "+1", pattern: "(###) ###-####" },
    { name: "Kanada", code: "+1", pattern: "(###) ###-####" },
  ];

  // ----------------- Helper funksiyalar -----------------
  const onlyDigits = (value) => (value || "").replace(/\D/g, "");

  const countMaskDigits = (mask) => (mask.match(/#/g) || []).length;

  function applyMask(digits, mask) {
    let result = "";
    let di = 0;

    for (let ch of mask) {
      if (ch === "#") {
        if (di >= digits.length) break;
        result += digits[di++];
      } else {
        if (di < digits.length) result += ch;
      }
    }

    if (di < digits.length) {
      result += " " + digits.slice(di);
    }

    return result;
  }

  // ----------------- DOM elementlar -----------------
  const dropdownToggle = document.getElementById("dropdownToggle");
  const dropdownList = document.getElementById("dropdownList");
  const selectedCodeEl = document.getElementById("selectedCode");
  const chev = document.getElementById("chev");
  const localPhone = document.getElementById("localPhone");
  const form = document.getElementById("form");
  const submitBtn = form.querySelector(".plan-list-btn");

  // ----------------- Telefon raqamni tayyorlash -----------------
  function prepareDigits(raw) {
    const currentMask = localPhone.dataset.mask || "### ### ####";
    const maxDigits =
      parseInt(
        localPhone.dataset.maxDigits || countMaskDigits(currentMask),
        10,
      ) || 20;

    let digits = onlyDigits(raw != null ? raw : localPhone.value || "");
    const codeDigits = onlyDigits(selectedCodeEl.textContent || "");

    if (
      digits.length > maxDigits &&
      codeDigits &&
      digits.startsWith(codeDigits)
    ) {
      digits = digits.slice(codeDigits.length);
    }

    if (digits.length > maxDigits) {
      digits = digits.slice(0, maxDigits);
    }

    return {
      digits,
      mask: currentMask,
      max: maxDigits,
    };
  }

  // ----------------- Dropdownni to'ldirish -----------------
  dropdownList.innerHTML = COUNTRIES.map(
    (country, index) => `
      <div 
        class="dropdown__item" 
        role="option" 
        data-index="${index}" 
        data-value="${country.code}"
        data-pattern="${country.pattern}" 
        data-country="${country.name}" 
        tabindex="-1"
      >
        <span class="country-name">${country.name}</span>
        <span class="country-code">${country.code}</span>
      </div>
    `,
  ).join("");

  let items = Array.from(dropdownList.querySelectorAll(".dropdown__item"));

  let selectedIndex = COUNTRIES.findIndex((c) => c.code === "+998");
  if (selectedIndex === -1) selectedIndex = 0;

  let isOpen = false;
  let focusedIndex = selectedIndex;

  // ----------------- Country tanlash funksiyasi -----------------
  function selectCountry(index, { keepOpen = false } = {}) {
    items.forEach((el, i) =>
      el.setAttribute("aria-selected", i === index ? "true" : "false"),
    );

    selectedIndex = index;
    focusedIndex = index;

    const country = COUNTRIES[index];

    selectedCodeEl.textContent = country.code;

    const mask = country.pattern;
    const maxDigits = countMaskDigits(mask);

    localPhone.dataset.mask = mask;
    localPhone.dataset.maxDigits = String(maxDigits);
    localPhone.placeholder = mask.replace(/#/g, "0");

    let digits = onlyDigits(localPhone.value || "");
    const codeDigits = onlyDigits(country.code);

    if (
      digits.length > maxDigits &&
      codeDigits &&
      digits.startsWith(codeDigits)
    ) {
      digits = digits.slice(codeDigits.length);
    }

    if (digits.length > maxDigits) {
      digits = digits.slice(0, maxDigits);
    }

    localPhone.value = applyMask(digits, mask);

    if (!keepOpen) {
      closeDropdown();
      setTimeout(() => {
        localPhone.focus();
        try {
          localPhone.setSelectionRange(
            localPhone.value.length,
            localPhone.value.length,
          );
        } catch (_) {}
      }, 0);
    }
  }

  // ----------------- Dropdown ochish / yopish -----------------
  function openDropdown() {
    dropdownList.classList.add("open");
    chev.classList.add("open");
    dropdownToggle.setAttribute("aria-expanded", "true");
    isOpen = true;

    (items[focusedIndex] || items[0]).focus();
  }

  function closeDropdown() {
    dropdownList.classList.remove("open");
    chev.classList.remove("open");
    dropdownToggle.setAttribute("aria-expanded", "false");
    isOpen = false;
    // o.focus() NI QOLDIRMADIK – inputga halaqit bermasin
  }

  // ----------------- Boshlang'ich holat -----------------
  items = Array.from(dropdownList.querySelectorAll(".dropdown__item"));
  selectCountry(selectedIndex, { keepOpen: true });

  setTimeout(() => {
    if (localPhone.value) {
      const { digits, mask } = prepareDigits(localPhone.value);
      localPhone.value = applyMask(digits, mask);
    }
  }, 100);

  // ----------------- Eventlar: dropdown toggle -----------------
  dropdownToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    isOpen ? closeDropdown() : openDropdown();
  });

  dropdownToggle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDropdown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openDropdown();
      items[items.length - 1].focus();
    }
  });

  // ----------------- Eventlar: dropdown ichida -----------------
  dropdownList.addEventListener("click", (e) => {
    const item = e.target.closest(".dropdown__item");
    if (!item) return;

    const index = parseInt(item.dataset.index, 10);
    if (Number.isNaN(index)) return;

    selectCountry(index);
  });

  dropdownList.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % items.length;
      items[focusedIndex].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + items.length) % items.length;
      items[focusedIndex].focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const index = parseInt(document.activeElement.dataset.index, 10);
      if (!Number.isNaN(index)) selectCountry(index);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  });

  // ----------------- iPhone FIX: touchstart / mousedown -----------------
  function focusPhoneHandler(e) {
    // iOS Safari’da boshqa click/tap’lar chiqib ketmasligi uchun
    if (e.type === "touchstart") {
      e.preventDefault();
    }
    e.stopPropagation();

    if (isOpen) {
      closeDropdown();
    }

    setTimeout(() => {
      localPhone.focus();
      try {
        localPhone.setSelectionRange(
          localPhone.value.length,
          localPhone.value.length,
        );
      } catch (_) {}
    }, 0);
  }

  // iOS uchun touchstart (passive:false) + desktop uchun mousedown
  localPhone.addEventListener("touchstart", focusPhoneHandler, {
    passive: false,
  });
  localPhone.addEventListener("mousedown", focusPhoneHandler);

  // Extra: click bo‘lsa ham faqat fokusda qoldiramiz
  localPhone.addEventListener("click", (e) => {
    e.stopPropagation();
    localPhone.focus();
    try {
      localPhone.setSelectionRange(
        localPhone.value.length,
        localPhone.value.length,
      );
    } catch (_) {}
  });

  // Fokus bo'lganda dropdownni yopamiz
  localPhone.addEventListener("focus", () => {
    if (isOpen) closeDropdown();
  });

  // ----------------- Input: faqat raqam + mask -----------------
  localPhone.addEventListener("keydown", (e) => {
    const allowedControlKeys = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End",
    ];

    if (allowedControlKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
      return;
    }

    if (/^\d$/.test(e.key)) {
      const { digits, max } = prepareDigits(localPhone.value);
      const selectionLen =
        localPhone.selectionEnd - localPhone.selectionStart || 0;

      if (digits.length >= max && selectionLen === 0) {
        e.preventDefault();
      }
    } else {
      e.preventDefault();
    }
  });

  localPhone.addEventListener("input", () => {
    const { digits, mask } = prepareDigits(localPhone.value);
    localPhone.value = applyMask(digits, mask);
  });

  localPhone.addEventListener("paste", (e) => {
    e.preventDefault();
    const text =
      (e.clipboardData || window.clipboardData).getData("text") || "";
    const { digits, mask } = prepareDigits(text);
    localPhone.value = applyMask(digits, mask);
  });

  // ----------------- Forma yuborish -----------------
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Юборилмоқда...";

    try {
      const name = (document.getElementById("name").value || "").trim();
      const { digits } = prepareDigits(localPhone.value);

      if (!name) {
        alert("Iltimos, ismingizni kiriting.");
        throw new Error("Name required");
      }
      if (!digits || digits.length < 3) {
        alert("Iltimos, telefon raqamingizni toʻliq kiriting.");
        throw new Error("Phone required");
      }

      const fullPhone = (selectedCodeEl.textContent || "+998") + digits;

      const fd = new FormData(form);
      const offertaCheck = document.querySelector(".offertaCheck");

      if (!offertaCheck.checked) {
        alert("Iltimos, Ommaviy Offerta shartlariga rozilikni tasdiqlang.");
        throw new Error("Offerta required");
      }
      const payload = {
        name: fd.get("Ism") || name,
        phone_number: fullPhone,
        type: fd.get("Tarif") || "",
        telegram: (fd.get("Telegram username") || "").toString().trim(),
        timestamp: new Date().toISOString(),
        offerta:
          offertaCheck && offertaCheck.checked ? "Roziman" : "Rozi emasman",
      };

      localStorage.setItem("formData", JSON.stringify(payload));

      try {
        const existing = localStorage.getItem("submissions");
        const arr = existing ? JSON.parse(existing) : [];
        arr.push(payload);
        localStorage.setItem("submissions", JSON.stringify(arr));
      } catch (_) {}

      window.location.href = "./pay.html";
    } catch (err) {
      console.error(err);
    } finally {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  });
})();
