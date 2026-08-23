const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbzNfVg7MO_ICDrAXYkV4g2nmY-EepzaW7TOapR60hW6oX98WAOscVBjVoOQz6-HwTL3/exec";

async function sendFormData() {
  const raw = localStorage.getItem("formData");
  if (!raw) return void console.log("Malumotlar yoq");
  const data = JSON.parse(raw);
  const body = new FormData();
  body.append("sheetName", "Lead");
  body.append("Ism", data.Ism);
  body.append("Telefon raqam", data.TelefonRaqam);
  body.append("Royhatdan o'tgan vaqti", data.SanaSoat);
  try {
    const res = await fetch(SHEET_URL, { method: "POST", body });
    if (!res.ok) throw new Error("API response was not ok");
    localStorage.removeItem("formData");
  } catch (err) {
    console.error("Error submitting form:", err);
    const el = document.getElementById("errorMessage");
    if (el) el.style.display = "block";
  }
}
window.onload = sendFormData;
