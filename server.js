import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/solve", async (req, res) => {
  try {
    const { imageData, subject = "auto", explanation = "detailed", language = "Arabic" } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "لم يتم إعداد مفتاح الذكاء الاصطناعي بعد. انسخ .env.example إلى ملف .env وأضف OPENAI_API_KEY."
      });
    }

    if (typeof imageData !== "string" || !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageData)) {
      return res.status(400).json({ error: "ارفع صورة بصيغة PNG أو JPG أو WEBP أو GIF أولًا." });
    }

    const encoded = imageData.split(",")[1] || "";
    const estimatedBytes = Math.floor(encoded.length * 0.75);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "حجم الصورة كبير. اختر صورة أقل من 8 ميجابايت." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const prompt = `أنت مساعد تعليمي دقيق. اقرأ ورقة الأسئلة المرفقة ثم أجب عن جميع الأسئلة التي يمكن قراءتها.
المادة: ${subject === "auto" ? "حدد المادة من الورقة" : subject}.
مستوى الشرح: ${explanation === "brief" ? "مختصر مع سبب الإجابة" : explanation === "step" ? "خطوة بخطوة وبالتفصيل" : "واضح ومفصل مناسب للطالب"}.
لغة الإجابة: ${language}.
التزم بالآتي:
1) حافظ على ترتيب الأسئلة وأرقامها.
2) لكل سؤال اكتب "السؤال"، ثم "الإجابة"، ثم "الشرح".
3) في الاختيار من متعدد، اذكر نص الاختيار الصحيح وحرفه إن كان ظاهرًا.
4) في الرياضيات والعلوم، وضح الخطوات والقوانين والوحدات عند الحاجة.
5) لا تخمن نصًا غير واضح. اذكر بوضوح الجزء غير المقروء واطلب صورة أوضح إذا لزم.
6) إذا كانت الورقة تحتوي على عدة صفحات مصورة في صورة واحدة، عالج كل ما تستطيع قراءته.
7) استخدم تنسيق Markdown بعناوين وقوائم واضحة.
8) لا تدّعِ اليقين إذا كان السؤال ملتبسًا.`;

    const response = await client.responses.create({
      model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageData, detail: "high" }
        ]
      }]
    });

    const answer = response.output_text?.trim();
    if (!answer) {
      return res.status(502).json({ error: "لم تصل إجابة قابلة للعرض. جرّب مرة أخرى بصورة أوضح." });
    }

    res.json({ answer });
  } catch (error) {
    console.error("Solve request failed:", error?.message || error);
    const status = error?.status === 401 ? 502 : 500;
    res.status(status).json({
      error: error?.status === 401
        ? "مفتاح API غير صالح. راجع المفتاح في ملف .env."
        : "حصل خطأ أثناء حل الورقة. تأكد من الاتصال وإعدادات API ثم حاول مرة أخرى."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Omar AI Solver is running at http://localhost:${PORT}`);
});