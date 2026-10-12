const form = document.querySelector("#solve-form");
const input = document.querySelector("#image-input");
const dropzone = document.querySelector("#dropzone");
const previewWrap = document.querySelector("#preview-wrap");
const preview = document.querySelector("#preview");
const fileName = document.querySelector("#file-name");
const removeButton = document.querySelector("#remove-image");
const solveButton = document.querySelector("#solve-button");
const buttonText = document.querySelector("#button-text");
const resultSection = document.querySelector("#result-section");
const loading = document.querySelector("#loading");
const errorBox = document.querySelector("#error-box");
const answer = document.querySelector("#answer");
const copyButton = document.querySelector("#copy-button");
const printButton = document.querySelector("#print-button");

let selectedFile = null;
let imageData = null;

document.querySelector("#year").textContent = new Date().getFullYear();

function showFile(file) {
  if (!file) return;
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    showError("نوع الملف غير مدعوم. اختر صورة PNG أو JPG أو WEBP أو GIF.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showError("حجم الصورة أكبر من 8 ميجابايت. اختر صورة أصغر.");
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    imageData = reader.result;
    preview.src = imageData;
    fileName.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    previewWrap.classList.remove("hidden");
    dropzone.classList.add("has-image");
    clearError();
  };
  reader.onerror = () => showError("تعذر قراءة الصورة. حاول اختيارها مرة أخرى.");
  reader.readAsDataURL(file);
}

input.addEventListener("change", () => showFile(input.files?.[0]));
removeButton.addEventListener("click", () => {
  selectedFile = null;
  imageData = null;
  input.value = "";
  preview.removeAttribute("src");
  previewWrap.classList.add("hidden");
});

for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
}
dropzone.addEventListener("drop", (event) => showFile(event.dataTransfer?.files?.[0]));

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}
function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function markdownToSafeHtml(markdown) {
  // Escape HTML first, then implement a small, safe Markdown subset.
  let html = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^---+$/gm, "<hr>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const lines = html.split("\n");
  let out = "";
  let listType = null;
  const closeList = () => {
    if (listType) out += listType === "ul" ? "</ul>" : "</ol>";
    listType = null;
  };
  for (const line of lines) {
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) { closeList(); out += nextType === "ul" ? "<ul>" : "<ol>"; listType = nextType; }
      out += `<li>${(unordered || ordered)[1]}</li>`;
    } else {
      closeList();
      if (line.trim() === "") continue;
      if (/^<(h[1-3]|hr)\b/.test(line)) out += line;
      else out += `<p>${line}</p>`;
    }
  }
  closeList();
  return out;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  if (!selectedFile || !imageData) {
    showError("اختار صورة ورقة الأسئلة الأول، وبعدها اضغط على زر الحل.");
    return;
  }

  resultSection.classList.remove("hidden");
  loading.classList.remove("hidden");
  answer.innerHTML = "";
  solveButton.disabled = true;
  buttonText.textContent = "جاري تحليل الورقة...";
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageData,
        subject: document.querySelector("#subject").value,
        explanation: document.querySelector("#explanation").value,
        language: "Arabic"
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "تعذر حل الورقة. حاول مرة أخرى.");
    answer.innerHTML = markdownToSafeHtml(data.answer || "");
  } catch (error) {
    showError(error.message || "تعذر الاتصال بالخادم. تأكد من تشغيل الموقع والاتصال بالإنترنت.");
  } finally {
    loading.classList.add("hidden");
    solveButton.disabled = false;
    buttonText.textContent = "حل الورقة واشرح الإجابات";
  }
});

copyButton.addEventListener("click", async () => {
  const text = answer.innerText.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "تم النسخ ✓";
    setTimeout(() => copyButton.textContent = "نسخ الحل", 1800);
  } catch {
    showError("المتصفح منع النسخ التلقائي. حدّد الحل وانسخه يدويًا.");
  }
});
printButton.addEventListener("click", () => window.print());