/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import LoginGate from "./components/LoginGate";
import MerchantDashboard from "./components/MerchantDashboard";
import CustomerChat from "./components/CustomerChat";
import { 
  Store, Monitor, Smartphone, AppWindow, Wifi, AlertTriangle, HelpCircle, RefreshCw, Layers, MessageCircle, X 
} from "lucide-react";
import { Product, KnowledgePair, StoreSettings, NetworkStatus, AnalyticsSummary } from "./types";
import { ProductService, KnowledgeBaseService, SettingsService, connectionManager, DatabaseResetService } from "./lib/dataService";
import { motion, AnimatePresence } from "motion/react";

// Initial mock products dataset to make the app incredibly polished out-of-the-box (Cleared by request)
const initialProducts: Product[] = [];

// Initial Custom Knowledge Base questions pairs (Cleared by request)
const initialKB: KnowledgePair[] = [];

export default function App() {
  // Application view modes: 'merchant' (dashboard) | 'customer' (chat portal) | 'dual' (both side by side)
  const [viewMode, setViewMode] = useState<'merchant' | 'customer' | 'dual'>('dual');
  
  // Login Gate state for merchant application
  const [isMerchantLoggedIn, setIsMerchantLoggedIn] = useState(false);

  // Sync state parameters default setup
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('connected');

  // Interactive connection transition toast notification state
  const [toast, setToast] = useState<{ id: number; message: string; type: NetworkStatus } | null>(null);
  const prevStatusRef = useRef<NetworkStatus>('connected');

  // Custom setter to propagate simulator status changes directly to Central ConnectionManager
  const handleSetNetworkStatus = (status: NetworkStatus) => {
    connectionManager.setStatus(status);
  };

  // Core global local-first states
  const [products, setProducts] = useState<Product[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgePair[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: "شركة مامو - الرقة",
    welcomeMessage: "أهلاً بك في شركة مامو! تفضل بالاستفسار عن أي بضاعة وسأقوم بحساب الأسعار وعرضها لك فورا بالدولار والليرات السورية.",
    phone: "+33 6 60 16 79 48",
    whatsApp: "+33 6 60 16 79 48",
    address: "الرقة - صالة العرض الكبرى بجوار دوار الدلة",
    geminiAPIKey: ""
  });

  // Analytics summary log dynamic state
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    totalConversations: 12,
    frequentQuestions: [
      { question: "أوقات وعنوان فرع الرقة الرئيسي للمحل", count: 8 },
      { question: "طراق التأكد ومطابقة أسعار المنتجات المتاحة", count: 4 }
    ],
    commonKeywords: [
      { word: "سعر", count: 12 },
      { word: "تواصل", count: 9 },
      { word: "منتج", count: 5 },
      { word: "عنوان", count: 4 }
    ],
    recentLogs: [
      { id: "log-1", question: "أين تقع الصالة الرئيسية للمحل؟", resolvedLocally: true, timestamp: "11:30" },
      { id: "log-2", question: "بكم سعر بن مامو بالليرة؟", resolvedLocally: true, timestamp: "11:24" },
      { id: "log-3", question: "اكتب لي أسعار الكاكاو بالدولار الأمريكي", resolvedLocally: false, timestamp: "10:50" }
    ]
  });

  // Load from database services and subscribe to connection / data changes
  useEffect(() => {
    // Initialize status ref with present connection status
    prevStatusRef.current = connectionManager.getStatus();

    // 1. Subscribe to connection status changes reactive feed
    const unsubscribeStatus = connectionManager.registerStatusListener((status) => {
      const prev = prevStatusRef.current;
      if (prev !== status) {
        prevStatusRef.current = status;
        
        let message = "";
        if (status === 'offline') {
          message = "⚠️ انقطع الاتصال بالشبكة! تم تفعيل وضع أوفلاين لحفظ التعديلات محلياً بفضل تقنية الدمج الذاتي (Offline-First).";
        } else if (status === 'syncing') {
          message = "🔄 تم رصد الشبكة مجدداً! جاري إرسال التغييرات المحلية المتراكمة ومزامنتها الآن مع السحاب...";
        } else if (status === 'connected') {
          if (prev === 'offline' || prev === 'syncing') {
            message = "✅ تم تأكيد اتصال السحاب! اكتملت المزامنة بنجاح والبيانات متطابقة كلياً الآن.";
          }
        }

        if (message) {
          const toastId = Date.now();
          setToast({
            id: toastId,
            message,
            type: status
          });
          // Auto clear after 6 seconds
          setTimeout(() => {
            setToast((curr) => curr?.id === toastId ? null : curr);
          }, 6000);
        }
      }
      setNetworkStatus(status);
    });

    // 2. Pre-seed baseline products if local cache is completely empty
    const seedIfNeeded = async () => {
      const savedProducts = localStorage.getItem("mamo_store_products");
      const savedKB = localStorage.getItem("mamo_store_kb");
      const savedSettings = localStorage.getItem("mamo_store_settings");

      if (!savedProducts) {
        localStorage.setItem("mamo_store_products", JSON.stringify(initialProducts));
        setProducts(initialProducts);
      }
      if (!savedKB) {
        localStorage.setItem("mamo_store_kb", JSON.stringify(initialKB));
        setKnowledgeBase(initialKB);
      }
      if (!savedSettings) {
        localStorage.setItem("mamo_store_settings", JSON.stringify(settings));
      }
    };

    // 3. Complete init fetch routine
    const loadData = async () => {
      // Automatic program-level reset v4 to ensure old preseeded/saved data and Firestore collections are wiped!
      const statusWiped = localStorage.getItem("mamo_data_wiped_v4_success");
      if (statusWiped !== "true") {
        try {
          await DatabaseResetService.resetAllData(false);
        } catch (e) {
          console.error("Auto reset error:", e);
        }
        localStorage.setItem("mamo_data_wiped_v4_success", "true");
        localStorage.removeItem("mamo_merchant_logged_in");
        setIsMerchantLoggedIn(false);
        setProducts([]);
        setKnowledgeBase([]);
        
        const dSettings: StoreSettings = {
          storeName: "شركة مامو - الرقة",
          logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300",
          welcomeMessage: "أهلاً ومرحباً بكم في شركة مامو - الرقة! نسعد بخدمتكم وتوفير كافة طلباتكم من المواد والسلع المتميزة. ما الذي تبحث عنه اليوم بالصالة؟",
          phone: "+33 6 60 16 79 48",
          whatsApp: "+33 6 60 16 79 48",
          address: "الرقة - صالة العرض الكبرى بجوار دوار الدلة",
          geminiAPIKey: ""
        };
        setSettings(dSettings);

        const dAnalytics = {
          totalConversations: 0,
          frequentQuestions: [],
          commonKeywords: [],
          recentLogs: []
        };
        setAnalytics(dAnalytics);
        localStorage.setItem("mamo_store_analytics", JSON.stringify(dAnalytics));
      }

      await seedIfNeeded();
      await connectionManager.checkConnection();

      const p = await ProductService.getAllProducts();
      if (p && p.length > 0) setProducts(p);

      const k = await KnowledgeBaseService.getAllKB();
      if (k && k.length > 0) setKnowledgeBase(k);

      const s = await SettingsService.getSettings();
      if (s) setSettings(s);
    };

    // 4. Listen to any local/remote state updates
    const unsubscribeChanges = connectionManager.registerChangeListener(async () => {
      const p = await ProductService.getAllProducts();
      if (p) setProducts(p);

      const k = await KnowledgeBaseService.getAllKB();
      if (k) setKnowledgeBase(k);

      const s = await SettingsService.getSettings();
      if (s) setSettings(s);
    });

    loadData();

    const savedAnalytics = localStorage.getItem("mamo_store_analytics");
    if (savedAnalytics) setAnalytics(JSON.parse(savedAnalytics));

    const savedLogin = localStorage.getItem("mamo_merchant_logged_in");
    if (savedLogin === "true") setIsMerchantLoggedIn(true);

    return () => {
      unsubscribeStatus();
      unsubscribeChanges();
    };
  }, []);

  // Save changes to localStorage on adjustments (acts as offline recovery/backup cache)
  useEffect(() => {
    if (products.length > 0) {
      localStorage.setItem("mamo_store_products", JSON.stringify(products));
    }
  }, [products]);

  useEffect(() => {
    if (knowledgeBase.length > 0) {
      localStorage.setItem("mamo_store_kb", JSON.stringify(knowledgeBase));
    }
  }, [knowledgeBase]);

  useEffect(() => {
    localStorage.setItem("mamo_store_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("mamo_store_analytics", JSON.stringify(analytics));
  }, [analytics]);

  // Wrapped interceptors to trigger Cloud database synchronizations reactively
  const handleSetProducts = (val: React.SetStateAction<Product[]>) => {
    setProducts(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      if (next.length < prev.length) {
        const deletedId = prev.find(p => !next.some(n => n.id === p.id))?.id;
        if (deletedId) {
          ProductService.deleteProduct(deletedId);
        }
      } else {
        next.forEach(p => {
          const matchingPrev = prev.find(old => old.id === p.id);
          if (!matchingPrev || JSON.stringify(matchingPrev) !== JSON.stringify(p)) {
            ProductService.saveProduct(p);
          }
        });
      }
      return next;
    });
  };

  const handleSetKnowledgeBase = (val: React.SetStateAction<KnowledgePair[]>) => {
    setKnowledgeBase(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      if (next.length < prev.length) {
        const deletedId = prev.find(k => !next.some(n => n.id === k.id))?.id;
        if (deletedId) {
          KnowledgeBaseService.deleteKB(deletedId);
        }
      } else {
        next.forEach(k => {
          const matchingPrev = prev.find(old => old.id === k.id);
          if (!matchingPrev || JSON.stringify(matchingPrev) !== JSON.stringify(k)) {
            KnowledgeBaseService.saveKB(k);
          }
        });
      }
      return next;
    });
  };

  const handleSetSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    SettingsService.saveSettings(newSettings);
  };

  const handleResetDatabase = async () => {
    if (confirm("🚨 هل أنت متأكد تماماً من رغبتك في تصفير وحذف كافة البيانات؟\n\nهذا الإجراء سيقوم بحذف جميع المنتجات، والأسئلة الشائعة المعرفية، وسجل دردشات الزبائن، وإعادة تعيين معلومات وهوية المتجر إلى الإعداد القياسي الافتراضي بالكامل!")) {
      if (confirm("⚠️ تأكيد أخير قبل الحذف النهائي:\nلا يمكن التراجع عن هذا الإجراء وسيتم مسح البيانات بشكل دائم من الخادم السحابي ومن جهازك. هل تود المتابعة؟")) {
        await DatabaseResetService.resetAllData();
        setProducts([]);
        setKnowledgeBase([]);
        
        const defaultSettings: StoreSettings = {
          storeName: "شركة مامو - الرقة",
          logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300",
          welcomeMessage: "أهلاً ومرحباً بكم في شركة مامو - الرقة! نسعد بخدمتكم وتوفير كافة طلباتكم من المواد والسلع المتميزة. ما الذي تبحث عنه اليوم بالصالة؟",
          phone: "+33 6 60 16 79 48",
          whatsApp: "+33 6 60 16 79 48",
          address: "الرقة - صالة العرض الكبرى بجوار دوار الدلة",
          geminiAPIKey: ""
        };
        setSettings(defaultSettings);
        
        const defaultAnalytics = {
          totalConversations: 0,
          frequentQuestions: [],
          commonKeywords: [],
          recentLogs: []
        };
        setAnalytics(defaultAnalytics);
        localStorage.setItem("mamo_store_analytics", JSON.stringify(defaultAnalytics));
        alert("✓ تم تصفير وحذف جميع البيانات بنجاح، وإعادة تهيئة الهوية القياسية للمتجر بنجاح!");
      }
    }
  };

  // Handle client-side log tracking from customer chatbot immediately
  const handleNewQuestionLogged = (question: string, resolvedLocally: boolean) => {
    const cleanWord = question.trim().toLowerCase();
    if (!cleanWord) return;

    const timeStr = new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' });

    setAnalytics(prev => {
      // 1. Increment total chats
      const totalConversations = prev.totalConversations + 1;

      // 2. Append to logs (keep last 100)
      const newLog = {
        id: `log-entry-${Date.now()}`,
        question,
        resolvedLocally,
        timestamp: timeStr
      };
      const recentLogs = [newLog, ...prev.recentLogs].slice(0, 100);

      // 3. Extract keywords (split by space with size > 3)
      const words = cleanWord.split(/\s+/).filter(w => w.length > 3 && !["سعر", "منتج", "معكم", "عنكم", "هذا", "هذه"].includes(w));
      const keywordMap = { ...prev.commonKeywords.reduce((acc, curr) => ({ ...acc, [curr.word]: curr.count }), {} as Record<string, number>) };
      
      words.forEach(wd => {
        keywordMap[wd] = (keywordMap[wd] || 0) + 1;
      });

      const commonKeywords = Object.entries(keywordMap)
        .map(([word, count]) => ({ word, count: Number(count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      // 4. Update frequent questions lists
      const questionMap = { ...prev.frequentQuestions.reduce((acc, curr) => ({ ...acc, [curr.question]: curr.count }), {} as Record<string, number>) };
      // Simplify question check to categorize roughly
      const categoryLabel = question.length > 30 ? question.substring(0, 30) + "..." : question;
      questionMap[categoryLabel] = (questionMap[categoryLabel] || 0) + 1;

      const frequentQuestions = Object.entries(questionMap)
        .map(([q, count]) => ({ question: q, count: Number(count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      return {
        totalConversations,
        frequentQuestions,
        commonKeywords,
        recentLogs
      };
    });
  };

  const handleLogout = () => {
    if (confirm("هل تريد تسجيل الخروج من لوحة تحكم التاجر العميقة؟")) {
      localStorage.removeItem("mamo_merchant_logged_in");
      setIsMerchantLoggedIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#110d0c] text-[#fdfbf7] flex flex-col justify-between">
      
      {/* Global Top Action Control Panel with Advanced Polished Styling */}
      <header className="backdrop-blur-md bg-[#161210]/95 border-b border-[#c9a227]/25 py-4 px-6 relative shadow-2xl shrink-0 z-50">
        {/* Top ambient color-strip */}
        <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-[#802626] via-[#c9a227] to-[#802626] opacity-90" />
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo brand & Identity */}
          <div className="flex items-center space-x-reverse space-x-4">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#802626] to-[#451010] border-2 border-[#c9a227] flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(201,162,39,0.15)]">
              <Store className="w-6 h-6 text-[#fdfbf7]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-gradient-to-r from-[#c9a227] to-amber-500 text-black font-black px-2 py-0.5 rounded shadow">شركة مامو - الرقة</span>
                <span className="text-[8px] bg-neutral-800 text-gray-400 px-1.5 py-0.5 rounded border border-neutral-700">تحديث فوري LWW</span>
              </div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight mt-1 text-white flex items-center gap-1.5">
                بوابة معلومات وإدارة <span className="text-amber-200">{settings.storeName || "شركة مامو"}</span>
              </h1>
            </div>
          </div>

          {/* Selector view controls - Tab style */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-black/60 rounded-xl border border-neutral-800/80 shadow-inner select-none">
            
            <button
              type="button"
              onClick={() => setViewMode('merchant')}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'merchant'
                  ? "bg-[#802626] border border-[#c9a227]/40 text-white shadow-lg font-extrabold scale-105"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>🖥️ لوحة التاجر</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('customer')}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'customer'
                  ? "bg-[#802626] border border-[#c9a227]/40 text-white shadow-lg font-extrabold scale-105"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>📱 هاتف الزبون</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('dual')}
              className={`flex items-center space-x-reverse space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'dual'
                  ? "bg-gradient-to-l from-[#6b1e1e] to-[#802626] border border-[#c9a227] text-white shadow-md shadow-amber-900/45 scale-105 font-extrabold"
                  : "text-gray-400 hover:text-[#c9a227]"
              }`}
              title="عرض تطبيق الهاتف ولوحة تحكم التاجر جنباً إلى جنب لرؤية المزامنة اللحظية"
            >
              <Layers className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>👑 المعاينة المزدوجة</span>
            </button>

          </div>

          {/* Action buttons & Connection Widget */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Direct WhatsApp Easy Action Button */}
            <a
              href={`https://wa.me/33660167948?text=${encodeURIComponent("مرحباً شركة مامو، أود الاستفسار وطلب بعض المنتجات المتوفرة لديكم بالصالة.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 hover:scale-105 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-black transition-all shadow-lg shadow-emerald-950/50"
              title="تواصل مباشر وفوري عبر واتساب الإدارة"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current" />
              <span>واتساب مباشر السريع</span>
            </a>

            {/* Sync System indicator */}
            <div className="text-[10px] text-gray-300 font-mono flex items-center gap-1.5 bg-black/40 px-3 py-2 rounded-lg border border-neutral-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>المزامنة: نشطة</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main split display body rendering */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col items-center justify-center">
        
        {/* VIEW 1: MERCHANT ONLY DETAILED CONTROLS PANEL */}
        {viewMode === 'merchant' && (
          <div className="w-full max-w-5xl animate-fade-in">
            {isMerchantLoggedIn ? (
              <MerchantDashboard
                products={products}
                setProducts={handleSetProducts}
                knowledgeBase={knowledgeBase}
                setKnowledgeBase={handleSetKnowledgeBase}
                settings={settings}
                setSettings={handleSetSettings}
                networkStatus={networkStatus}
                setNetworkStatus={handleSetNetworkStatus}
                analytics={analytics}
                onLogout={handleLogout}
                onResetDatabase={handleResetDatabase}
              />
            ) : (
              <LoginGate onLoginSuccess={() => setIsMerchantLoggedIn(true)} />
            )}
          </div>
        )}

        {/* VIEW 2: CUSTOMER ONLY CHAT SCREEN */}
        {viewMode === 'customer' && (
          <div className="w-full max-w-md h-[600px] animate-fade-in relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-0.5 bg-[#c9a227] text-black text-[9px] font-black rounded-full uppercase tracking-wider shadow z-20">
              Customer Mobile View
            </div>
            <CustomerChat
              products={products}
              knowledgeBase={knowledgeBase}
              settings={settings}
              onNewQuestionLogged={handleNewQuestionLogged}
            />
          </div>
        )}

        {/* VIEW 3: LIVE CO-SYNC SIDE-BY-SIDE PRESENTATION STAGE */}
        {viewMode === 'dual' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Col: Merchant portal (taking 7 cols) */}
            <div className="lg:col-span-8 space-y-3">
              <div className="p-3 bg-gradient-to-r from-[#6b1e1e]/20 to-transparent border border-[#c9a227]/20 rounded-xl flex items-center justify-between text-xs text-[#fdfbf7]/80">
                <span className="flex items-center gap-2 font-semibold">
                  <Monitor className="w-4 h-4 text-[#c9a227]" />
                  شاشة التاجر (تطبيق مستقل): جرب تعديل الأسعار وعرض المزامنة التلقائية.
                </span>
                <span className="text-[10px] text-gray-500 font-mono hidden md:inline">INDEX LOCAL STORAGE CO-WORKER LIVE</span>
              </div>
              
              {isMerchantLoggedIn ? (
                <MerchantDashboard
                  products={products}
                  setProducts={handleSetProducts}
                  knowledgeBase={knowledgeBase}
                  setKnowledgeBase={handleSetKnowledgeBase}
                  settings={settings}
                  setSettings={handleSetSettings}
                  networkStatus={networkStatus}
                  setNetworkStatus={handleSetNetworkStatus}
                  analytics={analytics}
                  onLogout={handleLogout}
                  onResetDatabase={handleResetDatabase}
                />
              ) : (
                <LoginGate onLoginSuccess={() => setIsMerchantLoggedIn(true)} />
              )}
            </div>

            {/* Right Col: Customer floating chat phone mock (taking 4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="p-3 bg-gradient-to-r from-[#c9a227]/20 to-transparent border border-[#c9a227]/20 rounded-xl text-xs text-amber-300 font-semibold flex items-center gap-2 justify-between">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  محاكي هاتف الزبون (QR Scan)
                </span>
                <span className="text-[9px] bg-[#6B1E1E] text-white px-2 py-0.5 rounded uppercase font-bold text-[9px]">Live Preview</span>
              </div>

              {/* Styled virtual phone casing wrapper containing customer chat */}
              <div className="bg-[#1e1a17] p-3 pt-6 rounded-[32px] border-4 border-neutral-700 shadow-2xl relative max-w-sm mx-auto h-[600px] flex flex-col">
                {/* Mobile camera notch decoration */}
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-black rounded-full z-20 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-neutral-800 border border-neutral-700 ml-6" />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-900 border border-sky-800" />
                </div>

                <div className="flex-1 overflow-hidden rounded-2xl bg-white h-full">
                  <CustomerChat
                    products={products}
                    knowledgeBase={knowledgeBase}
                    settings={settings}
                    onNewQuestionLogged={handleNewQuestionLogged}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer copyright */}
      <footer className="bg-[#110d0c] border-t border-[#c9a227]/10 py-4 px-6 text-center text-[11px] text-gray-500 font-mono shrink-0 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <span>متجر مامو السوري © {new Date().getFullYear()} - جميع الحقوق محفوظة لـ شركة مامو - الرقة والشركاء المعتمدين.</span>
          <span className="text-[10px] text-gray-600">
            نظام آمن متكامل ومزامنة سحابية دورية.
          </span>
        </div>
      </footer>

      {/* Dynamic Connection Transition Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            id="network-status-toast"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed bottom-6 right-6 z-[9999] max-w-sm w-[90%] sm:w-full p-4 rounded-xl shadow-2xl flex items-start gap-3 border transition-colors duration-300 ${
              toast.type === "offline"
                ? "bg-[#251515] border-rose-500/40 text-rose-100 shadow-rose-950/40"
                : toast.type === "syncing"
                ? "bg-[#2a2217] border-amber-500/40 text-amber-100 shadow-amber-950/40"
                : "bg-[#16251b] border-emerald-500/40 text-emerald-100 shadow-emerald-950/40"
            }`}
          >
            {/* Status specific icons */}
            {toast.type === "offline" && (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
            )}
            {toast.type === "syncing" && (
              <RefreshCw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-spin" />
            )}
            {toast.type === "connected" && (
              <Wifi className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}

            {/* Message details */}
            <div className="flex-1">
              <h4 className="text-xs font-black text-[#fdfbf7] mb-1">
                {toast.type === "offline" && "تنبيه النظام (دون اتصال)"}
                {toast.type === "syncing" && "مزامنة البيانات"}
                {toast.type === "connected" && "الربط السحابي نشط"}
              </h4>
              <p className="text-[11px] leading-relaxed font-sans">{toast.message}</p>
            </div>

            {/* Close button */}
            <button
              id="close-toast-btn"
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition cursor-pointer shrink-0"
              title="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
