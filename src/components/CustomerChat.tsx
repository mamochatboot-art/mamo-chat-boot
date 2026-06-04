/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Send, Bot, User, Phone, MapPin, Sparkles, MessageSquare, AlertCircle, 
  ArrowUp, Compass, ShoppingBag, Clock, Truck, ChevronLeft, RefreshCw, MessageCircle
} from "lucide-react";
import { Product, KnowledgePair, StoreSettings, ChatMessage } from "../types";
import { ChatLogService } from "../lib/dataService";
import { ProductImageCarousel } from "./ProductImageCarousel";

interface CustomerChatProps {
  products: Product[];
  knowledgeBase: KnowledgePair[];
  settings: StoreSettings;
  onNewQuestionLogged: (question: string, resolvedLocally: boolean) => void;
}

export default function CustomerChat({ products, knowledgeBase, settings, onNewQuestionLogged }: CustomerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Clean and normalize text to help matching Arabic variations
  const normalizeArabic = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[^\w\s\u0600-\u06FF]/g, ''); // Keep words and Arabic letters
  };

  // Helper to map dynamic high-quality custom Unsplash images for products to feel premium
  const getProductImage = (productId: string): string => {
    if (productId === "prod-1") {
      // Premium bubbles chocolate
      return "https://images.unsplash.com/photo-1548907040-4d42b52145ca?auto=format&fit=crop&q=80&w=400";
    }
    if (productId === "prod-2") {
      // Damascus cardamom coffee
      return "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400";
    }
    if (productId === "prod-3") {
      // Cocoa with Syrian rose
      return "https://images.unsplash.com/photo-1544787219-7f41ccb56574?auto=format&fit=crop&q=80&w=400";
    }
    return "https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&q=80&w=400";
  };

  // Intelligent client-side search to scan bots response for products to show rich cards dynamically
  const findMatchedProductInText = (text: string): Product | undefined => {
    for (const prod of products) {
      const normalizedProdName = normalizeArabic(prod.name);
      const normalizedText = normalizeArabic(text);
      
      // Direct containment or key terms intersection
      if (normalizedText.includes(normalizedProdName)) {
        return prod;
      }
      
      // Individual words match check
      const keywords = normalizedProdName.split(" ").filter(w => w.length > 2);
      if (keywords.length > 0 && keywords.every(word => normalizedText.includes(word))) {
        return prod;
      }
    }
    return undefined;
  };

  // Perform localized searching step-by-step
  const processLocalAnswer = (rawMessage: string): { 
    matchedText: string; 
    source: 'knowledge_base' | 'product'; 
    product?: Product;
    isFallback?: boolean;
  } | null => {
    const query = normalizeArabic(rawMessage);
    if (!query) return null;

    // --- STEP 1: Search inside Knowledge Base (knowledge_base) ---
    for (const kp of knowledgeBase) {
      const qNormalized = normalizeArabic(kp.question);
      if (query.includes(qNormalized) || qNormalized.includes(query)) {
        return { matchedText: kp.answer, source: 'knowledge_base' };
      }

      // Intersection words matching
      const queryWords = query.split(/\s+/).filter(w => w.length > 2);
      const qWords = qNormalized.split(/\s+/).filter(w => w.length > 2);
      if (queryWords.length > 0) {
        const matchesCount = queryWords.filter(word => qWords.includes(word)).length;
        if (matchesCount >= Math.max(1, Math.floor(queryWords.length * 0.75))) {
          return { matchedText: kp.answer, source: 'knowledge_base' };
        }
      }
    }

    // Direct Store Information & contact handles mapped to 'knowledge_base'
    if (query.includes("رقم") || query.includes("تواصل") || query.includes("تلفون") || query.includes("واتساب") || query.includes("واتس") || query.includes("هاتف") || query.includes("موبايل")) {
      return {
        matchedText: `تسعدنا خدمتك جداً يا غالي! يمكنك التواصل المباشر والسريع مع إدارة متجرنا على الأرقام التالية:\n\n📞 هاتف صالة العرض: ${settings.phone || "غير محدد"}\n💬 واتس مبيعات الجملة والتجزئة: ${settings.whatsApp || "غير محدد"}\n\nيسعدنا تواصلكم دائماً!`,
        source: 'knowledge_base'
      };
    }
    
    if (query.includes("موقع") || query.includes("عنوان") || query.includes("مكان") || query.includes("وين") || query.includes("المحل") || query.includes("بين") || query.includes("الرقة")) {
      return {
        matchedText: `أهلاً بك يا طيب! يسرنا استقبالكم والتشرف بزيارتكم العزيزة في صالة عرض متجرنا:\n\n📍 ${settings.address || "سوريا، الرقة"}\n\nتفضلوا بزيارتنا لتجربة البضاعة مباشرة!`,
        source: 'knowledge_base'
      };
    }

    // --- STEP 2: Search inside products ---
    for (const prod of products) {
      const pNormalized = normalizeArabic(prod.name);
      if (query.includes(pNormalized) || pNormalized.includes(query)) {
        return { 
          matchedText: `تفاصيل منتجنا المعتمد الأصلي *"${prod.name}"*:\n\n✍️ الوصف: ${prod.description}\n💲 السعر بالدولار: ${prod.priceUSD} USD\n💰 السعر بالليرة: ${prod.priceSYP.toLocaleString()} ل.س\n📌 الخواص المتاحة: ${prod.attributes.map(a => `${a.key}: ${a.value}`).join(" | ")}`,
          source: 'product',
          product: prod
        };
      }
    }

    // Check for general product requests
    if (query.includes("منتج") || query.includes("بضاع") || query.includes("اسعار") || query.includes("شو عندكم") || query.includes("شو في") || query.includes("الاصناف") || query.includes("كتالوج") || query.includes("معرض")) {
      if (products.length > 0) {
        return {
          matchedText: `تفضل يا غالي، يسعدنا عرض بضاعتنا الحالية المتاحة للطلب الفوري:\n\n${products.map((p, i) => `${i+1}. ${p.name} - السعر: ${p.priceUSD} USD / ${p.priceSYP.toLocaleString()} ل.س`).join("\n")}`,
          source: 'product',
          product: products[0]
        };
      }
    }

    // Handle complaints or generic falls
    if (query.includes("شكوى") || query.includes("مشكله") || query.includes("صعب") || query.includes("غالي") || query.includes("غش") || query.includes("عطل")) {
      return {
        matchedText: "لم أتمكن من العثور على إجابة دقيقة. يمكنك التواصل المباشر مع صالة عرض شركة مامو - الرقة وسنقوم بمتابعة طلبك فوراً.",
        source: 'knowledge_base',
        isFallback: true
      };
    }

    return null;
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    
    const textToProcess = customText !== undefined ? customText : inputVal;
    if (!textToProcess.trim() || isLoading) return;

    setErrorMessage("");
    const userText = textToProcess.trim();
    if (customText === undefined) {
      setInputVal("");
    }

    const timestampStr = new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' });

    // Append user message immediately
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      text: userText,
      timestamp: timestampStr
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // 1 & 2. Attempt local matching (Step 1 KB first, Step 2 Products second)
    const localCheck = processLocalAnswer(userText);
    if (localCheck !== null) {
      setTimeout(() => {
        const localMsg: ChatMessage = {
          id: `bot-local-${Date.now()}`,
          role: "model",
          text: localCheck.matchedText,
          matchedProduct: localCheck.product,
          isFallback: localCheck.isFallback,
          timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, localMsg]);
        setIsLoading(false);
        onNewQuestionLogged(userText, true);

        // Record log with matching source to Firebase Firestore chat_logs
        ChatLogService.logChatToBackend(userText, localCheck.matchedText, localCheck.source);
      }, 450); // elegant human-like delay
      return;
    }

    // 3. Fall back to AI Proxy server-side processing to keep Keys hidden (Step 3)
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          products: products,
          knowledgeBase: knowledgeBase,
          settings: settings
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "تعذرت تلبية الطلب من السيرفر التلقائي.");
      }

      const responseData = await response.json();
      const replyText = responseData.reply;

      // Smart Product match checks on generated AI responses
      const autoMatchedProduct = findMatchedProductInText(replyText);

      const botMsg: ChatMessage = {
        id: `bot-ai-${Date.now()}`,
        role: "model",
        text: replyText,
        matchedProduct: autoMatchedProduct,
        timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      onNewQuestionLogged(userText, false);

      // Save conversational response with 'gemini' source to Firestore logs
      ChatLogService.logChatToBackend(userText, replyText, "gemini");
    } catch (err: any) {
      console.error("Chat engine fetch failure:", err);
      
      // Fallback elegant no-understanding message inside chat instead of crashing
      const fallbackErrorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: "model",
        text: "لم أتمكن من العثور على إجابة دقيقة حالياً في النظام المحل المعتمد. يرجى التواصل مع إدارة شركة مامو مباشرة.",
        isFallback: true,
        timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackErrorMsg]);

      // Log fallback to chat_logs
      ChatLogService.logChatToBackend(userText, fallbackErrorMsg.text, "fallback_error");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to handle quick suggestion click
  const handleSuggestionClick = (text: string) => {
    handleSendMessage(undefined, text);
  };

  return (
    <div id="customer-chat-ui" className="flex flex-col h-full bg-[#FCF9F5] text-[#1D1917] font-sans overflow-hidden select-none">
      
      {/* 1. BRAND HEADER - Inspired by iMessage & Apple Premium look */}
      <header className="bg-[#FFFFFF]/95 backdrop-blur-md py-3.5 px-5 border-b border-[#c9a227]/10 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        
        {/* Store Logo & Dynamic text */}
        <div className="flex items-center space-x-reverse space-x-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6b1e1e] to-[#c9a227] flex items-center justify-center p-0.5 overflow-hidden shadow-md ring-2 ring-[#c9a227]/20">
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt={settings.storeName} 
                  className="w-full h-full object-cover rounded-full bg-[#FCF9F5]" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-white font-extrabold text-xs">M</div>
              )}
            </div>
            {/* Elegant luxury pulse dot */}
            <span className="absolute bottom-0 left-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
          </div>

          <div>
            <h1 className="text-sm font-extrabold text-[#1a1716] tracking-tight leading-tight">{settings?.storeName || "متجر مامو السوري"}</h1>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              خدمة العملاء متاحة حالياً
            </p>
          </div>
        </div>

        {/* Local Support Badges */}
        <div className="text-left font-mono">
          <div className="text-[9px] text-[#c9a227] font-black tracking-widest leading-none uppercase">المساعد التلقائي للمحل</div>
          <span className="text-[8px] px-1.5 py-0.5 bg-[#6B1E1E]/5 rounded text-[#6B1E1E] inline-block font-sans font-semibold mt-1">توجيه فوري</span>
        </div>
      </header>

      {/* 2. MAIN CONVERSATION PANEL */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 bg-gradient-to-b from-[#FFFDFB] to-[#FAF5EF]">
        
        {/* Welcome Section - ChatGPT/Apple Messages elegant layout shown only when there are no messages */}
        {messages.length === 0 && (
          <div id="welcome-unit" className="my-6 text-center space-y-6 max-w-sm mx-auto animate-fade-in p-6 bg-white rounded-2xl border border-[#c9a227]/10 shadow-[0_4px_20px_rgba(201,162,39,0.04)]">
            
            {/* Elegant centered icon */}
            <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-[#fcf9f5] to-white border border-[#c9a227]/30 flex items-center justify-center text-[#c9a227] shadow-sm">
              <Bot className="w-7 h-7 text-[#6B1E1E]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#1a1716] tracking-tight flex items-center justify-center gap-1.5">
                مرحباً بك 👋
              </h2>
              <p className="text-[13px] text-[#6b1e1e] font-extrabold">أنا مساعد متجر مامو التلقائي.</p>
            </div>

            <div className="text-right bg-[#fcf9f5] p-3.5 rounded-xl border border-[#c9a227]/10 space-y-2">
              <p className="text-xs font-bold text-gray-500 leading-none">يمكنني مساعدتك في معرفة:</p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-[#1a1716] font-semibold">
                <span className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-150">
                  💴 مراجعة الأسعار
                </span>
                <span className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-150">
                  ⚙️ تفاصيل المواصفات
                </span>
                <span className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-150">
                  🟢 توفر المعرض
                </span>
                <span className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-150">
                  💎 جودة البضائع
                </span>
              </div>
            </div>

            {/* Quick Suggestions segment */}
            <div className="space-y-2 pt-3">
              <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide flex items-center justify-center gap-1">
                <Compass className="w-3.5 h-3.5 text-[#c9a227]" />
                اسأل المساعد فوراً عن طريق هذه الخيارات:
              </div>
              
              <div className="grid grid-cols-2 gap-2 select-none">
                <button
                  type="button"
                  onClick={() => handleSuggestionClick("ما هي أسعار المنتجات المتوفرة؟")}
                  className="p-2.5 bg-white hover:bg-neutral-50 rounded-xl text-center border border-[#c9a227]/20 text-[11px] font-extrabold text-[#6B1E1E] shadow-xs active:scale-98 transition cursor-pointer"
                >
                  ما هي الأسعار؟
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick("هل منتج شوكولاتة مامو متوفر؟")}
                  className="p-2.5 bg-white hover:bg-neutral-50 rounded-xl text-center border border-[#c9a227]/20 text-[11px] font-extrabold text-[#6B1E1E] shadow-xs active:scale-98 transition cursor-pointer"
                >
                  هل المنتج متوفر؟
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick("ما هي طرق الحساب المقبولة لديكم؟")}
                  className="p-2.5 bg-white hover:bg-neutral-50 rounded-xl text-center border border-[#c9a227]/20 text-[11px] font-extrabold text-[#6B1E1E] shadow-xs active:scale-98 transition cursor-pointer"
                >
                  طرق المحاسبة والعملة
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick("ما هي أوقات وعناوين العمل الرسمية؟")}
                  className="p-2.5 bg-white hover:bg-neutral-50 rounded-xl text-center border border-[#c9a227]/20 text-[11px] font-extrabold text-[#6B1E1E] shadow-xs active:scale-98 transition cursor-pointer"
                >
                  أوقات العمل
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic dialog bubbles rendering */}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex w-full ${isUser ? "justify-end" : "justify-start"} items-start gap-2.5 group animate-fade-in`}
            >
              <div className="flex flex-col max-w-[85%] space-y-1">
                {/* Visual bubble wrapper with tailored RTL direction alignment */}
                <div
                  className={`px-4.5 py-3 rounded-2.5xl text-[13px] leading-relaxed relative ${
                    isUser
                      ? "bg-[#6B1E1E]/8 text-[#3A0D0D] rounded-br-[4px] font-medium border border-[#6B1E1E]/10"
                      : "bg-[#FFFFFF] text-[#1D1917] rounded-bl-[4px] border border-[#c9a227]/15 shadow-sm"
                  }`}
                  style={{ direction: 'rtl' }}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* ELEGANT FALLBACK / MISUNDERSTANDING COMPONENT (communicating buttons inside the Chat) */}
                  {msg.isFallback && (
                    <div className="mt-4 pt-3 border-t border-[#c9a227]/10 space-y-2.5">
                      <div className="text-[11px] text-gray-400 font-semibold mb-1">تواصل مباشرة لحل طلبك فوراً:</div>
                      
                      <div className="flex flex-col gap-2">
                        {/* WhatsApp high quality direct action target */}
                        <a
                          href={`https://wa.me/${settings.whatsApp.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition transform active:scale-98 text-center"
                        >
                          <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          <span>تراسل معنا عبر واتساب مباشر</span>
                        </a>

                        {/* Telephone dial direct action */}
                        <a
                          href={`tel:${settings.phone}`}
                          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#6B1E1E] hover:bg-[#852727] text-white rounded-xl text-xs font-black shadow-xs transition transform active:scale-98 text-center"
                        >
                          <Phone className="w-4 h-4 text-[#c9a227]" />
                          <span>اتصل بالهاتف المباشر صالة العرض</span>
                        </a>

                        {/* Location on map physical finder */}
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(settings.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-l from-neutral-850 to-neutral-900 border border-[#c9a227]/20 text-[#fdfbf7] rounded-xl text-xs font-black shadow-xs transition transform active:scale-98 text-center"
                        >
                          <MapPin className="w-4 h-4 text-[#c9a227]" />
                          <span>رؤية موقع المحل على خرائط Google</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* 4. PRODUCT CARD ATTACHMENT INSIDE BANNER (If product is matched) */}
                  {msg.matchedProduct && (
                    <div className="mt-4 pt-3 border-t border-[#c9a227]/10 animate-fade-in text-right">
                      <div className="text-[10px] text-gray-400 font-extrabold flex items-center gap-1 mb-2">
                        <ShoppingBag className="w-3 h-3 text-[#c9a227]" />
                        تم رصد منتج حقيقي بالكتالوج:
                      </div>

                      <div className="bg-[#FAF5EF] rounded-2xl overflow-hidden border border-[#c9a227]/20 shadow-xs flex flex-row p-3 items-center gap-3">
                        {/* High quality visual representation with image Carousel */}
                        <ProductImageCarousel 
                          productId={msg.matchedProduct.id} 
                          productName={msg.matchedProduct.name} 
                        />

                        {/* Text details content */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-[#1a1716] truncate leading-tight">
                            {msg.matchedProduct.name}
                          </h4>
                          
                          {/* Rich pricing line with currencies */}
                          <div className="flex flex-col gap-0.5 mt-1 text-[11px] leading-tight font-mono">
                            <span className="text-emerald-700 font-extrabold">Price: ${msg.matchedProduct.priceUSD} USD</span>
                            <span className="text-[#6B1E1E] font-black">{msg.matchedProduct.priceSYP.toLocaleString()} ل.س</span>
                          </div>

                          {/* Dynamic visual Availability Status exactly as requested */}
                          <div className="mt-2">
                            {msg.matchedProduct.status === 'available' && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-900/40 shadow-xs">
                                🟢 متوفر
                              </span>
                            )}
                            {msg.matchedProduct.id === 'prod-2' && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-amber-950 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-900/40 shadow-xs">
                                🟡 كمية محدودة
                              </span>
                            )}
                            {msg.matchedProduct.status === 'out_of_stock' && msg.matchedProduct.id !== 'prod-2' && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-rose-950 text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-900/40 shadow-xs">
                                🔴 غير متوفر
                              </span>
                            )}
                            {msg.matchedProduct.status === 'unavailable' && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-rose-950 text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-900/40 shadow-xs">
                                🔴 غير متوفر
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Interactive Buttons Row */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {/* Direct purchase help link on catalog */}
                        <button
                          type="button"
                          onClick={() => handleSuggestionClick(`أريد طلب هذا المنتج: "${msg.matchedProduct?.name}"`)}
                          className="w-full text-center text-[10px] py-2 bg-[#6B1E1E]/5 hover:bg-[#6B1E1E]/10 rounded-lg text-[#6B1E1E] font-black border border-[#6B1E1E]/15 transition flex items-center justify-center gap-1"
                        >
                          <span>🛒 طلب حجز فوري</span>
                        </button>

                        {/* Direct WhatsApp Call & Inquiry */}
                        <a
                          href={`https://wa.me/${settings.whatsApp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`مرحباً شركة مامو، أود الاستفسار حول منتج: "${msg.matchedProduct?.name}"`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full text-center text-[10px] py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg transition flex items-center justify-center gap-1 shadow-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>استفسار واتساب</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Elegant small timestamp log below dialog bubble */}
                <span className={`text-[8px] px-1 font-mono text-gray-400 ${isUser ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {/* Typing loading screen representing AI thinking */}
        {isLoading && (
          <div className="flex w-full justify-start items-start gap-2.5 animate-pulse">
            <div className="flex flex-col max-w-[80%] space-y-1">
              <div className="px-4 py-3 bg-[#FFFFFF] border border-[#c9a227]/15 rounded-2xl rounded-bl-[4px] shadow-xs text-sm">
                <div id="typing-bubble" className="flex items-center space-x-reverse space-x-1.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6B1E1E] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6B1E1E] animate-bounce delay-100" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-bounce delay-200" />
                  <span className="text-[11px] text-[#6B1E1E] mr-2 font-black">جاري الاستعلام الفوري والرد...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Scroll anchoring helper */}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. FIXED BOTTOM WRITING BOX */}
      <footer className="bg-[#FFFFFF] border-t border-[#c9a227]/10 p-3 pt-2 shadow-[0_-2px_15px_rgba(0,0,0,0.03)] sticky bottom-0 z-20">
        
        {/* Simple input alignment container */}
        <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2 max-w-lg mx-auto relative">
          
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="اكتب رسالتك أو سؤالك هنا يا غالي..."
            className="flex-1 pl-12 pr-4.5 py-3 bg-[#FCF9F5] border border-[#c9a227]/25 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6b1e1e] text-[#1a1716] shadow-inner font-medium placeholder:text-gray-400"
            required
            disabled={isLoading}
          />
          
          {/* ChatGPT Style round primary floating key button */}
          <button
            type="submit"
            disabled={isLoading || !inputVal.trim()}
            className="w-10 h-10 bg-[#6B1E1E] disabled:bg-gray-200 disabled:text-gray-400 hover:bg-[#802626] text-white rounded-full transition-all shadow-md active:scale-95 shrink-0 flex items-center justify-center text-center cursor-pointer"
            title="إرسال السؤال"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </form>

        {/* Secure local context badge */}
        <div className="text-center text-[8px] text-gray-400 mt-2 font-mono flex items-center justify-center gap-1.5 selection:bg-transparent">
          <span>متصل بمحرك الاستعلام المحلي السريع • Mamo Chatbot</span>
        </div>
      </footer>

    </div>
  );
}
