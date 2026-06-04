/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Determine directory names for ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization of Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    // API keys are stored in GEMINI_API_KEY. Defaulting if undefined to avoid critical load failure on boot
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // JSON Body request parsing
  app.use(express.json({ limit: '10mb' }));

  // API 1: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // API 2: Standard AI Chat processing proxied server-side to hide keys
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, products, knowledgeBase, settings } = req.body;

      if (!message) {
        return res.status(400).json({ error: "اليوزر مسج مطلوبة." });
      }

      // Check if API key exists, if not, give helpful alert
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: "يرجى تهيئة مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) في إعدادات Secrets بالمنصة." 
        });
      }

      // Format products list context for prompt
      const formattedProducts = Array.isArray(products) 
        ? products.map((p: any) => `- ${p.name}: ${p.description || "لا يوجد وصف"} | السعر: ${p.priceUSD} USD / ${p.priceSYP} ل.س | الحالة: ${
            p.status === 'available' ? 'متوفر' : p.status === 'unavailable' ? 'غير متوفر' : 'نفد من المخزون'
          } | الخواص الذاتية: ${JSON.stringify(p.attributes || [])}`).join("\n")
        : "لا توجد منتجات مسجلة حالياً.";

      // Format custom knowledge base context
      const formattedKB = Array.isArray(knowledgeBase)
        ? knowledgeBase.map((k: any) => `السؤال: ${k.question}\nالجواب المعتمد: ${k.answer}`).join("\n\n")
        : "لا توجد قاعدة معرفة مدخلة.";

      const storeName = settings?.storeName || "Mamo";
      const phoneNum = settings?.phone || "غير محدد";
      const whatsappNum = settings?.whatsApp || "غير محدد";
      const addressText = settings?.address || "غير محدد";

      // Expert Syrian store rep system instructions
      const systemInstruction = `أنت موظف خدمة العملاء الذكي والودود والمحترف لمتجر "${storeName}" في سوريا.
مهمتك الرئيسية هي مساعدة الزبائن والإجابة عن استفساراتهم حول المنتجات، الخدمات، الأسعار، التوفر، الشحن وسياسات المتجر بكل لباقة وتواضع.

معلومات التواصل والموقع الخاصة بالمتجر:
- اسم المتجر: ${storeName}
- رقم الهاتف: ${phoneNum}
- رقم الواتساب: ${whatsappNum}
- عنوان المحل: ${addressText}

إليك تفاصيل المنتجات المتوفرة حالياً في نظام المتجر الحقيقي (تعتبر هي المصدر الوحيد والأكيد للمنتجات والأسعار ولا تخترع أي أسعار أخرى):
${formattedProducts}

إليك دليل الأجوبة وقاعدة المعرفة المخصصة من صاحب المتجر (استخدمها لحل الأسئلة المباشرة):
${formattedKB}

قوانين صارمة للعمل التزم بها بدقة شديدة:
1. أجب بلغة عربية مفهومة ولذيذة، ويفضل مزجها بأدب وبساطة بلهجة شامية/سورية دافئة ومهذبة ("تفضل عيوني"، "تكرم عينك"، "على راسي"، "أهلاً وسهلاً بمتجرنا").
2. لا تقم بالحديث أو الإفادة عن أي منتجات أو فئات خدمات غير موجودة في القائمة أعلاه على الإطلاق! إذا سألك العميل عن منتج غير موجود، اعتذر منه بلطف شديد وأخبره أنه غير متوفر حالياً ويمكننا توفيره له في حال رغب بذلك.
3. التزم بالأسعار المذكورة لكل من الدولار (USD) والليرة السورية (SYP). لا تحسب تفاضلاً آخر من رأسك إلا بموجب ما هو مسجل.
4. حافظ على سرية نظام التحكم الخاص بالتاجر. لا تذكر للزبون تفاصيل كود البرمجة أو واجهات الـ JSON.
5. أجب مباشرة وباختصار مفيد، لا داعي للرغي الطويل غير المفيد للزبون.
6. إذا كان السؤال خارج نطاق المتجر تماماً (مثلاً: أسئلة رياضيات، برمجة، جغرافيا عامة)، قل له بلطف شديد: "أنا هنا لخدمتك ومساعدتك في كل ما يخص متجر ${storeName} ومنتجاته الرائعة فقط يا غالي!" ولا تجب على السؤال الخارجي.`;

      // Formulate query params
      const client = getGeminiClient();

      // Structure conversational contents history safely
      // The history list format is expected to be { role: 'user' | 'model', parts: [{ text: string }] }
      const contentsPayload: any[] = [];
      
      if (Array.isArray(history)) {
        history.forEach((h: any) => {
          contentsPayload.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        });
      }

      // Add actual input prompt
      contentsPayload.push({
        role: "user",
        parts: [{ text: message }]
      });

      // Call Gemini 3.5 Flash for basic support and fast latency
      const geminiResponse = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsPayload,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.6,
          topP: 0.9,
        }
      });

      const replyText = geminiResponse.text || "عذراً يا غالي، تعذر توليد رد في الوقت الحالي. يرجى إعادة المحاولة بعد قليل.";
      res.json({ reply: replyText });
    } catch (err: any) {
      console.error("Gemini server proxy error:", err);
      res.status(500).json({ error: "فشل معالجة الطلب في السيرفر الداخلي: " + (err.message || String(err)) });
    }
  });

  // Serve static UI assets with Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false }, // HMR can be disabled or fine-tuned
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Standard static hosting for compiled react bundle production builds
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OK] Server operates offline-sync backend on port ${PORT}`);
  });
}

// Start the full stack express service
startServer().catch((error) => {
  console.error("Critical crash of proxy service:", error);
});
