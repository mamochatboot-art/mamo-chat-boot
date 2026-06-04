/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { 
  Store, Package, Database, BarChart3, QrCode, Settings, LogOut, 
  Wifi, WifiOff, RefreshCw, Plus, Trash2, Edit2, CheckCircle2, 
  X, HelpCircle, ArrowLeft, Download, Printer, FileText, Search, Tag, Eye, Clock, AlertTriangle
} from "lucide-react";
import { Product, KnowledgePair, StoreSettings, NetworkStatus, ProductAttribute, AnalyticsSummary } from "../types";
import { StoreQRCodeWidget } from "./StoreQRCodeWidget";

interface MerchantDashboardProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  knowledgeBase: KnowledgePair[];
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgePair[]>>;
  settings: StoreSettings;
  setSettings: (s: StoreSettings) => void;
  networkStatus: NetworkStatus;
  setNetworkStatus: (status: NetworkStatus) => void;
  analytics: AnalyticsSummary;
  onLogout: () => void;
  onResetDatabase?: () => void;
}

export default function MerchantDashboard({
  products,
  setProducts,
  knowledgeBase,
  setKnowledgeBase,
  settings,
  setSettings,
  networkStatus,
  setNetworkStatus,
  analytics,
  onLogout,
  onResetDatabase
}: MerchantDashboardProps) {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'products' | 'kb' | 'analytics' | 'qr' | 'settings'>('products');

  // Products UI form states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPriceUSD, setProdPriceUSD] = useState(0);
  const [prodPriceSYP, setProdPriceSYP] = useState(0);
  const [prodStatus, setProdStatus] = useState<Product['status']>('available');
  const [prodAttrs, setProdAttrs] = useState<ProductAttribute[]>([]);
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");

  // Knowledge UI form states
  const [editingKB, setEditingKB] = useState<KnowledgePair | null>(null);
  const [showKBModal, setShowKBModal] = useState(false);
  const [kbQuest, setKbQuest] = useState("");
  const [kbAnsw, setKbAnsw] = useState("");

  // Client QR code print states
  const [qrPrinting, setQrPrinting] = useState(false);

  // Settings form local state
  const [localSettings, setLocalSettings] = useState<StoreSettings>({ ...settings });

  // Sync animation helper
  const [isSyncing, setIsSyncing] = useState(false);

  // Syncing simulation trigger
  const triggerManualSync = () => {
    if (networkStatus === 'offline') return;
    setNetworkStatus('syncing');
    setIsSyncing(true);
    setTimeout(() => {
      setNetworkStatus('connected');
      setIsSyncing(false);
      // alert the user under safe frame rules
    }, 1500);
  };

  // Convert USD automatically to SYP with Syrian standard rates if input changes
  const handleUSDPriceChange = (usdVal: number) => {
    setProdPriceUSD(usdVal);
    // Typical Damascus parallel rate simulation: roughly 15,000 SYP per USD
    const estimatedSYP = usdVal * 15000;
    setProdPriceSYP(estimatedSYP);
  };

  // Attributes operations
  const addAttribute = () => {
    if (!newAttrKey.trim() || !newAttrVal.trim()) return;
    setProdAttrs(prev => [...prev, { key: newAttrKey.trim(), value: newAttrVal.trim() }]);
    setNewAttrKey("");
    setNewAttrVal("");
  };

  const removeAttribute = (index: number) => {
    setProdAttrs(prev => prev.filter((_, i) => i !== index));
  };

  // SAVE PRODUCT (Add/Edit)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    if (editingProduct) {
      // Modify product
      const updated: Product = {
        ...editingProduct,
        name: prodName.trim(),
        description: prodDesc.trim(),
        priceUSD: Number(prodPriceUSD),
        priceSYP: Number(prodPriceSYP),
        status: prodStatus,
        attributes: prodAttrs,
        updatedAt: new Date().toISOString()
      };
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p));
    } else {
      // Create product
      const created: Product = {
        id: `prod-${Date.now()}`,
        name: prodName.trim(),
        description: prodDesc.trim(),
        priceUSD: Number(prodPriceUSD),
        priceSYP: Number(prodPriceSYP),
        status: prodStatus,
        attributes: prodAttrs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setProducts(prev => [created, ...prev]);
    }

    // Reset and close
    setEditingProduct(null);
    setShowProductModal(false);
    clearProductForm();

    // Trigger auto-sync if online
    if (networkStatus === 'connected') {
      triggerManualSync();
    }
  };

  const clearProductForm = () => {
    setProdName("");
    setProdDesc("");
    setProdPriceUSD(0);
    setProdPriceSYP(0);
    setProdStatus('available');
    setProdAttrs([]);
    setNewAttrKey("");
    setNewAttrVal("");
  };

  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdDesc(p.description);
    setProdPriceUSD(p.priceUSD);
    setProdPriceSYP(p.priceSYP);
    setProdStatus(p.status);
    setProdAttrs(p.attributes || []);
    setShowProductModal(true);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (networkStatus === 'connected') {
        triggerManualSync();
      }
    }
  };

  // SAVE KNOWLEDGE PAIR
  const handleSaveKB = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbQuest.trim() || !kbAnsw.trim()) return;

    if (editingKB) {
      const updated: KnowledgePair = {
        ...editingKB,
        question: kbQuest.trim(),
        answer: kbAnsw.trim()
      };
      setKnowledgeBase(prev => prev.map(k => k.id === editingKB.id ? updated : k));
    } else {
      const created: KnowledgePair = {
        id: `kb-${Date.now()}`,
        question: kbQuest.trim(),
        answer: kbAnsw.trim(),
        createdAt: new Date().toISOString()
      };
      setKnowledgeBase(prev => [created, ...prev]);
    }

    setEditingKB(null);
    setShowKBModal(false);
    setKbQuest("");
    setKbAnsw("");

    if (networkStatus === 'connected') {
      triggerManualSync();
    }
  };

  const startEditKB = (k: KnowledgePair) => {
    setEditingKB(k);
    setKbQuest(k.question);
    setKbAnsw(k.answer);
    setShowKBModal(true);
  };

  const handleDeleteKB = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا السؤال المرجعي؟")) {
      setKnowledgeBase(prev => prev.filter(k => k.id !== id));
      if (networkStatus === 'connected') {
        triggerManualSync();
      }
    }
  };

  // SAVE SETTINGS
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(localSettings);
    // Visual validation sync trigger
    triggerManualSync();
  };

  // Generate virtual domain chat Link
  const chatURL = `${window.location.origin}/chat`;
  const qrImageURL = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(chatURL)}&choe=UTF-8&chld=H|2`;

  // QR Customizations
  const [qrColor, setQrColor] = useState("#6B1E1E");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [posterTitle, setPosterTitle] = useState(settings.storeName || "متجر مامو السوري");
  const [posterSubtitle, setPosterSubtitle] = useState("امسح الكود بكاميرا الموبايل للدردشة المباشرة والاطلاع على الأسعار والمواصفات فوراً!");
  const [qrDataURL, setQrDataURL] = useState("");

  // Sync title if settings.storeName changes
  useEffect(() => {
    setPosterTitle(settings.storeName || "متجر مامو السوري");
  }, [settings.storeName]);

  // Generate pure client-side QR Code using 'qrcode' library with custom coloring and branding!
  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(chatURL, {
          width: 600,
          margin: 2,
          color: {
            dark: qrColor,
            light: "#FFFFFF"
          },
          errorCorrectionLevel: 'H'
        });
        
        if (includeLogo) {
          const canvas = document.createElement("canvas");
          canvas.width = 600;
          canvas.height = 600;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const qrImg = new Image();
            qrImg.src = url;
            qrImg.onload = () => {
              ctx.drawImage(qrImg, 0, 0);
              
              const logoSize = 120;
              const x = (600 - logoSize) / 2;
              const y = (600 - logoSize) / 2;
              
              ctx.fillStyle = "#FFFFFF";
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(x - 6, y - 6, logoSize + 12, logoSize + 12, 14);
              } else {
                ctx.rect(x - 6, y - 6, logoSize + 12, logoSize + 12);
              }
              ctx.fill();
              
              if (settings.logoUrl) {
                const logoImg = new Image();
                logoImg.crossOrigin = "anonymous";
                logoImg.src = settings.logoUrl;
                logoImg.onload = () => {
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(300, 300, logoSize / 2, 0, Math.PI * 2);
                  ctx.clip();
                  ctx.drawImage(logoImg, x, y, logoSize, logoSize);
                  ctx.restore();
                  setQrDataURL(canvas.toDataURL("image/png"));
                };
                logoImg.onerror = () => {
                  ctx.fillStyle = "#6B1E1E";
                  ctx.beginPath();
                  ctx.arc(300, 300, logoSize / 2, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.fillStyle = "#FFFFFF";
                  ctx.font = "bold 60px Cairo, 'Inter', sans-serif";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText("M", 300, 305);
                  setQrDataURL(canvas.toDataURL("image/png"));
                };
              } else {
                ctx.fillStyle = "#6B1E1E";
                ctx.beginPath();
                ctx.arc(300, 300, logoSize / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 60px Cairo, 'Inter', sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("M", 300, 305);
                setQrDataURL(canvas.toDataURL("image/png"));
              }
            };
          }
        } else {
          setQrDataURL(url);
        }
      } catch (err) {
        console.error("QR Code rendering failure:", err);
      }
    };
    generateQR();
  }, [chatURL, qrColor, includeLogo, settings.logoUrl]);

  // Download QR Code ONLY as transparent background PNG
  const downloadPureQR = () => {
    if (!qrDataURL) return;
    const link = document.createElement("a");
    link.href = qrDataURL;
    link.download = `${posterTitle.replace(/\s+/g, '_')}_only_QR.png`;
    link.click();
  };

  // Compile full-resolution Canvas Poster to PNG
  const downloadPosterPNG = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background white fill
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 800, 1200);

    // Dynamic banner gradient
    const gradient = ctx.createLinearGradient(0, 0, 800, 250);
    gradient.addColorStop(0, "#6B1E1E");
    gradient.addColorStop(1, "#c9a227");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 220);

    // Thick custom framing
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, 760, 1160);

    // Inner thin margin border
    ctx.strokeStyle = "#6B1E1E";
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 42, 716, 1116);

    // Text details writing helper
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 42px Cairo, 'Inter', sans-serif";
    ctx.fillText(posterTitle, 400, 100);

    ctx.font = "bold 18px Cairo, 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("بوابة مساعدة العملاء والدردشة الفورية", 400, 160);

    const qrImg = new Image();
    qrImg.src = qrDataURL || qrImageURL;
    qrImg.onload = () => {
      const qrSize = 440;
      const x = (800 - qrSize) / 2;
      const y = 320;
      
      // Shadow behind QR representation
      ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
      
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x - 20, y - 20, qrSize + 40, qrSize + 40, 24);
      } else {
        ctx.rect(x - 20, y - 20, qrSize + 40, qrSize + 40);
      }
      ctx.fill();
      
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      
      // Draw actual custom QR onto poster
      ctx.drawImage(qrImg, x, y, qrSize, qrSize);

      ctx.fillStyle = "#1e1a17";
      ctx.font = "bold 24px Cairo, 'Inter', sans-serif";
      ctx.fillText("امسح الرمز بكاميرا جوالك مباشرة 📲", 400, 860);

      ctx.fillStyle = "#6B1E1E";
      ctx.font = "bold 18px Cairo, 'Inter', sans-serif";
      
      // Word wrap text to beautiful canvas lines
      const words = posterSubtitle.split(" ");
      let line = "";
      const lines = [];
      for (const word of words) {
        const testLine = line + word + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 600) {
          lines.push(line);
          line = word + " ";
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      let currentY = 910;
      lines.forEach(l => {
        ctx.fillText(l.trim(), 400, currentY);
        currentY += 32;
      });

      // Split separator
      ctx.strokeStyle = "rgba(201,162,39,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(100, 1050);
      ctx.lineTo(700, 1050);
      ctx.stroke();

      ctx.fillStyle = "#a3a3a3";
      ctx.font = "bold 14px Cairo, sans-serif";
      ctx.fillText(`العنوان: ${settings.address || "الرقة، سوريا"}  |  هاتف: ${settings.phone || "-"}`, 400, 1085);
      ctx.font = "normal 11px monospace";
      ctx.fillText(`Mamo Automated Portal - Live Local Response Engine`, 400, 1115);

      const downloadImgLink = document.createElement("a");
      downloadImgLink.href = canvas.toDataURL("image/png");
      downloadImgLink.download = `${posterTitle.replace(/\s+/g, '_')}_QR_Poster.png`;
      downloadImgLink.click();
    };
  };

  // Window Print target to save as A4 PDF perfectly
  const printPosterPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("يرجى فتح النوافذ المنبثقة أولاً لتوليد ملف الـ PDF وطباعته.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>بوستر QR - ${posterTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
          body {
            margin: 0;
            padding: 0;
            font-family: 'Cairo', sans-serif;
            background-color: #ffffff;
            color: #1a1716;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .poster-container {
            width: 210mm;
            height: 297mm;
            box-sizing: border-box;
            border: 15px solid #c9a227;
            padding: 20px;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            background-color: #ffffff;
            margin: auto;
          }
          .poster-inner-border {
            border: 2px solid #6B1E1E;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }
          .header-area {
            background: linear-gradient(135deg, #6B1E1E, #c9a227);
            width: calc(100% - 20px);
            padding: 30px 10px;
            border-radius: 15px;
            text-align: center;
            color: #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          }
          .header-area h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 900;
          }
          .header-area p {
            margin: 5px 0 0 0;
            font-size: 15px;
            opacity: 0.9;
          }
          .qr-wrapper {
            background-color: #ffffff;
            border: 3px solid #6b1e1e;
            padding: 15px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(107,30,30,0.05);
            margin: 40px 0;
          }
          .qr-image {
            width: 320px;
            height: 320px;
            display: block;
          }
          .instructions-wrapper {
            text-align: center;
            max-width: 500px;
          }
          .instructions-wrapper h2 {
            font-size: 20px;
            color: #1a1716;
            margin-bottom: 15px;
            font-weight: 900;
          }
          .instructions-wrapper p {
            font-size: 15px;
            color: #6B1E1E;
            line-height: 1.6;
            font-weight: 700;
            margin: 0;
          }
          .footer-address {
            border-top: 1px solid #c9a227;
            width: 80%;
            padding-top: 15px;
            text-align: center;
            font-size: 12px;
            color: #777777;
            font-weight: 700;
          }
          @media print {
            body {
              background: none;
            }
            .poster-container {
              width: 100%;
              height: 100vh;
              border: none;
              padding: 0;
            }
            .poster-container {
              border: 15px solid #c9a227 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="poster-container">
          <div class="poster-inner-border">
            <div class="header-area">
              <h1>${posterTitle}</h1>
              <p>بوابة مساعدة العملاء والدردشة الفورية</p>
            </div>
            
            <div class="qr-wrapper">
              <img class="qr-image" src="${qrDataURL || qrImageURL}" alt="QR Link Code">
            </div>

            <div class="instructions-wrapper">
              <h2>امسح الرمز بكاميرا جوالك مباشرة 📲</h2>
              <p>${posterSubtitle}</p>
            </div>

            <div class="footer-address">
              <span>العنوان: ${settings.address || "الرقة، سوريا"}</span>
              <br>
              <span style="font-size: 10px; font-family: monospace; opacity: 0.7;">Mamo Automated Portal • تم الإنشاء عبر بوابة التاجر بنجاح</span>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div id="merchant-desktop-shell" className="w-full min-h-[640px] bg-[#2a2421] text-[#fdfbf7] font-sans flex flex-col rounded-2xl overflow-hidden border-2 border-[#c9a227]/40 shadow-2xl relative">
      
      {/* OS Mac-like Title bar decoration for simulated Electron desktop experience */}
      <div className="bg-[#1e1a17] py-2 px-4 flex items-center justify-between border-b border-[#c9a227]/20 select-none">
        <div className="flex items-center space-x-reverse space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80 cursor-pointer hover:bg-red-600" onClick={onLogout} title="خروج" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="text-[10px] text-gray-500 font-mono mr-2">mamo-merchant-desktop.app</span>
        </div>
        <div className="text-xs font-semibold text-[#c9a227] flex items-center gap-1.5 justify-center">
          <Store className="w-4 h-4 text-[#c9a227]" />
          <span>تطبيق لوحة تحكم التاجر المستقل - متجر مامو</span>
        </div>
        
        {/* Dynamic header Auto Sync Engine Status panel */}
        <div className="flex items-center space-x-reverse space-x-3 text-xs bg-black/30 px-3 py-1 rounded-full border border-[#c9a227]/10 font-mono">
          <span className="text-[10px] text-[#fdfbf7]/60">شبكة المزامنة:</span>
          {networkStatus === 'connected' && (
            <span className="flex items-center text-emerald-400 gap-1.5 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              🟢 متصل ومزامن (Connected)
            </span>
          )}
          {networkStatus === 'offline' && (
            <span className="flex items-center text-rose-400 gap-1.5 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              🔴 أوفلاين (Offline Cached)
            </span>
          )}
          {networkStatus === 'syncing' && (
            <span className="flex items-center text-amber-400 gap-1.5 text-[11px] font-bold">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              🟡 جاري مزامنة السحاب...
            </span>
          )}

          {/* Offline manual Simulator trigger */}
          <button 
            type="button"
            onClick={() => setNetworkStatus(networkStatus === 'offline' ? 'connected' : 'offline')}
            className={`cursor-pointer text-[9px] px-2 py-0.5 rounded transition font-sans ${
              networkStatus === 'offline' 
                ? 'bg-[#c9a227] hover:bg-[#c9a227]/80 text-[#1e1a17]' 
                : 'bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300'
            }`}
            title="تغيير وضع الشبكة لمحاكاة قدرة العمل دون انترنت وضبط المزامنة التلقائية"
          >
            {networkStatus === 'offline' ? 'تشغيل الشبكة' : 'محاكاة وضع أوفلاين'}
          </button>
        </div>
      </div>

      {/* Main interface split dashboard */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[580px]">
        
        {/* Sidemenu navigation Bar */}
        <div className="w-full md:w-60 bg-[#1e1a17] border-l md:border-l border-b md:border-b-0 border-[#c9a227]/10 p-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="p-3 bg-gradient-to-l from-[#6B1E1E]/40 to-[#c9a227]/10 rounded-xl mb-6 border border-[#c9a227]/20">
              <div className="text-[10px] text-[#c9a227] font-semibold tracking-wider uppercase mb-0.5">الفرع النشط</div>
              <div className="font-bold text-sm truncate">{settings.storeName || "شركة مامو - الرقة"}</div>
              <div className="text-[9px] text-gray-500 leading-none mt-1">المحاسب المسؤول: مدير النظام</div>
            </div>

            {/* Menu Buttons container */}
            <nav className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'products'
                    ? "bg-[#6B1E1E] text-white border-r-4 border-[#c9a227] shadow"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Package className="w-4 h-4 shrink-0 text-[#c9a227]" />
                <span>🛍️ المنتجات والتسعير السوري</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('kb')}
                className={`w-full flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'kb'
                    ? "bg-[#6B1E1E] text-white border-r-4 border-[#c9a227] shadow"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Database className="w-4 h-4 shrink-0 text-[#c9a227]" />
                <span>✍️ دليل الأسئلة والمطابقة الآلية</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`w-full flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'analytics'
                    ? "bg-[#6B1E1E] text-white border-r-4 border-[#c9a227] shadow"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0 text-[#c9a227]" />
                <span>📊 إحصائيات ونشاط العملاء</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                className={`w-full flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'qr'
                    ? "bg-[#6B1E1E] text-white border-r-4 border-[#c9a227] shadow"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0 text-[#c9a227]" />
                <span>📢 ملصق الدعاية ووكالة QR</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'settings'
                    ? "bg-[#6B1E1E] text-white border-r-4 border-[#c9a227] shadow"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0 text-[#c9a227]" />
                <span>⚙️ إعدادات المتجر والمساعد الآلي</span>
              </button>
            </nav>
          </div>

          <div className="pt-4 border-t border-[#c9a227]/10 mt-6 space-y-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B1E1E]/20 text-[10px] rounded-lg border border-[#c9a227]/10">
              <Database className="w-3.5 h-3.5 text-[#c9a227]" />
              <div className="leading-tight text-gray-400">
                قاعدة البيانات المحلية: <span className="text-[#c9a227] font-bold">IndexedDB أوفلاين</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center space-x-reverse space-x-2.5 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-950/20 rounded-lg cursor-pointer transition select-none"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج آمن للمسؤول</span>
            </button>
          </div>
        </div>

        {/* Content body layout */}
        <div className="flex-1 p-6 bg-[#251e1b] overflow-y-auto">
          
          {/* TAB 1: PRODUCTS INVENTORY */}
          {activeTab === 'products' && (
            <div id="tab-products-container" className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#c9a227]/10 pb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#c9a227]" />
                    إدارة كتالوج المنتجات
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">تعديل وإضافة المخزون النشط للبيع والأسعار بالدولار والليرة السورية.</p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    clearProductForm();
                    setEditingProduct(null);
                    setShowProductModal(true);
                  }}
                  className="bg-gradient-to-l from-[#6b1e1e] to-[#912d2d] hover:from-[#912d2d] hover:to-[#6b1e1e] text-[#fdfbf7] text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 border border-[#c9a227]/30 cursor-pointer shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  إضافة منتج جديد
                </button>
              </div>

              {/* Products Table grid list */}
              {products.length === 0 ? (
                <div className="p-12 text-center bg-[#1e1a17]/50 rounded-2xl border border-[#c9a227]/10">
                  <Package className="w-12 h-12 text-[#c9a227]/30 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-400">لا توجد منتجات مسجلة في المتجر حتى الآن!</p>
                  <p className="text-xs text-gray-500 mt-1">انقر على زر "إضافة منتج جديد" لبدء إدخال بضاعتك الحالية.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {products.map((p) => (
                    <div 
                      key={p.id}
                      className="p-4 bg-[#1e1a17] rounded-xl border border-[#c9a227]/10 hover:border-[#c9a227]/30 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Title and stats layout */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#fdfbf7] flex items-center gap-1.5">
                              {p.name}
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                p.status === 'available' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/20' :
                                p.status === 'unavailable' ? 'bg-rose-900/40 text-rose-300 border border-rose-500/20' :
                                'bg-amber-900/40 text-amber-300 border border-amber-500/20'
                              }`}>
                                {p.status === 'available' ? 'متوفر' : p.status === 'unavailable' ? 'غير متوفر' : 'نفد المخزون'}
                              </span>
                            </h3>
                            <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed mr-1">
                              {p.description || "لا يوجد وصف للمنتج."}
                            </p>
                          </div>
                          
                          {/* edit/delete Buttons */}
                          <div className="flex items-center space-x-reverse space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditProduct(p)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 transition cursor-pointer"
                              title="تعديل المنتج"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 bg-rose-950/40 hover:bg-rose-900/40 rounded text-rose-300 transition cursor-pointer"
                              title="حذف المنتج"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Custom characteristics values */}
                        {p.attributes && p.attributes.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5 leading-none">
                            {p.attributes.map((a, idx) => (
                              <span key={idx} className="text-[9px] px-1.5 py-1 bg-[#2a2421] text-gray-300 rounded border border-[#c9a227]/10 font-mono">
                                <b className="text-[#c9a227]">{a.key}:</b> {a.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pricing Footer */}
                      <div className="mt-4 pt-3 border-t border-[#c9a227]/5 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-semibold font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#c9a227]" />
                          تحديث: {new Date(p.updatedAt).toLocaleDateString('ar-SY')}
                        </span>
                        
                        <div className="flex items-center space-x-reverse space-x-4">
                          <div className="text-right">
                            <div className="text-[10px] text-gray-500 font-semibold">سعر الدولار</div>
                            <div className="text-xs font-bold text-sky-300 font-mono">${p.priceUSD}</div>
                          </div>
                          <div className="text-right bg-gradient-to-r from-transparent to-[#c9a227]/5 px-2 py-0.5 rounded border border-[#c9a227]/10">
                            <div className="text-[10px] text-[#c9a227] font-semibold">سعر الليرة السورية</div>
                            <div className="text-xs font-extrabold text-amber-300 font-mono">{p.priceSYP.toLocaleString()} ل.س</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* TAB 2: KNOWLEDGE BASE */}
          {activeTab === 'kb' && (
            <div id="tab-kb-container" className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#c9a227]/10 pb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#c9a227]" />
                    قاعدة المعرفة والرد الآلي
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">تحديد أجوبة صارمة وثابتة على الأسئلة الشائعة للزبائن كمرجع أساسي فوري للمساعد التلقائي للمتجر.</p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setEditingKB(null);
                    setKbQuest("");
                    setKbAnsw("");
                    setShowKBModal(true);
                  }}
                  className="bg-gradient-to-l from-[#6b1e1e] to-[#912d2d] hover:from-[#912d2d] hover:to-[#6b1e1e] text-[#fdfbf7] text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 border border-[#c9a227]/30 cursor-pointer shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  إضافة سؤال وتوجيه جديد
                </button>
              </div>

              {knowledgeBase.length === 0 ? (
                <div className="p-12 text-center bg-[#1e1a17]/50 rounded-2xl border border-[#c9a227]/10">
                  <Database className="w-12 h-12 text-[#c9a227]/30 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-400">لا توجد توجيهات معرفية مخصصة حتى الآن!</p>
                  <p className="text-xs text-gray-500 mt-1">ادخل الأسئلة والردود الشائعة للمحل، لتشغيل الرد الفوري السريع دون استهلاك كروت الخدمة السحابية المتقدمة.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {knowledgeBase.map((k) => (
                    <div 
                      key={k.id}
                      className="p-4 bg-[#1e1a17] rounded-xl border border-[#c9a227]/10 hover:border-[#c9a227]/20 transition flex items-start gap-4 justify-between"
                    >
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 text-md font-bold text-amber-300">
                          <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 text-xs flex items-center justify-center border border-amber-500/20">س</span>
                          <h4>{k.question}</h4>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-300 pl-4 leading-relaxed bg-[#251e1b]/30 p-2.5 rounded-lg border border-[#c9a227]/5">
                          <span className="text-[#c9a227] font-bold">الجواب الموجه: </span>
                          <span className="whitespace-pre-line">{k.answer}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-reverse space-x-1 mr-4 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditKB(k)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 cursor-pointer"
                          title="تعديل هذا السؤال"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteKB(k.id)}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900/40 rounded text-rose-300 cursor-pointer"
                          title="حذف هذا السؤال"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* TAB 3: SYRIAN ANALYTICS METRICS */}
          {activeTab === 'analytics' && (
            <div id="tab-analytics-container" className="space-y-6">
              <div className="border-b border-[#c9a227]/10 pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#c9a227]" />
                  شاشات تحليل وإحصائيات الزبائن
                </h2>
                <p className="text-xs text-gray-400 mt-1">الرصد الفوري لكلمات البحث والأسئلة الشائعة التي يستفسر عنها الزبائن السوريون في الدردشة.</p>
              </div>

              {/* Statistical Bento boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Conversations count */}
                <div className="p-4 bg-gradient-to-br from-[#1e1a17] to-[#1e1a17]/40 rounded-xl border border-[#c9a227]/10">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">إجمالي المحادثات بالدردشة</div>
                  <div className="text-3xl font-extrabold text-[#c9a227] font-mono mt-1">{analytics.totalConversations}</div>
                  <p className="text-[10px] text-gray-400 mt-2">إجمالي حوارات العملاء المباشرة وسجلات المساعدة.</p>
                </div>

                {/* Local resolution percentage */}
                <div className="p-4 bg-gradient-to-br from-[#1e1a17] to-[#1e1a17]/40 rounded-xl border border-[#c9a227]/10">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">الاستجابة الفورية الآلية</div>
                  <div className="text-3xl font-extrabold text-emerald-300 font-mono mt-1">
                    {analytics.recentLogs.length > 0 
                      ? Math.round((analytics.recentLogs.filter(l => l.resolvedLocally).length / analytics.recentLogs.length) * 100) 
                      : 80}%
                  </div>
                  <p className="text-[10px] text-emerald-500/80 mt-2">معدل الإجابات السريعة من الذاكرة المحلية دون الحاجة لتمريرها إلى خوادم للتوليد المالي.</p>
                </div>

                {/* Fallback to Gemini Percentage */}
                <div className="p-4 bg-gradient-to-br from-[#1e1a17] to-[#1e1a17]/40 rounded-xl border border-[#c9a227]/10">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">معدل الاستعلام التلقائي المتقدم</div>
                  <div className="text-3xl font-extrabold text-sky-300 font-mono mt-1">
                    {analytics.recentLogs.length > 0 
                      ? Math.round((analytics.recentLogs.filter(l => !l.resolvedLocally).length / analytics.recentLogs.length) * 100) 
                      : 20}%
                  </div>
                  <p className="text-[10px] text-sky-400 mt-2">حجم الاستفسارات المتقدمة الموجهة سحابياً للإجابة الفورية المنسقة.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Most active Questions list */}
                <div className="p-4 bg-[#1e1a17] rounded-xl border border-[#c9a227]/10">
                  <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wider pb-3 border-b border-[#c9a227]/5">
                    الاستفسارات الأكثر شيوعاً وتكراراً
                  </h3>
                  {analytics.frequentQuestions.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-6">لا توجد استفسارات متكررة مسجلة في هذه الجلسة.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {analytics.frequentQuestions.map((fq, i) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-[#2a2421]/60 rounded border border-[#c9a227]/5">
                          <span className="font-semibold text-gray-300 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227]" />
                            {fq.question}
                          </span>
                          <span className="font-mono text-[10px] bg-[#6B1E1E] text-white px-2 py-0.5 rounded font-bold">
                            {fq.count} مرات
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Keywords Cloud analysis */}
                <div className="p-4 bg-[#1e1a17] rounded-xl border border-[#c9a227]/10">
                  <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wider pb-3 border-b border-[#c9a227]/5">
                    الكلمات الرئيسية الأكثر تحليلاً من أسئلة الزبائن
                  </h3>
                  {analytics.commonKeywords.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-6">جاري تشغيل المعالجة لتوليد الكلمات الأكثر تداولاً.</p>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {analytics.commonKeywords.map((ck, i) => {
                        const colors = ['bg-[#6B1E1E]/45 text-rose-200 border-rose-900/40', 'bg-[#c9a227]/15 text-yellow-200 border-yellow-900/40', 'bg-[#1b2b34] text-sky-200 border-sky-950/40'];
                        const selectedColor = colors[i % colors.length];
                        return (
                          <span key={i} className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 focus:outline-none ${selectedColor}`}>
                            <Tag className="w-3 h-3 text-[#c9a227]" />
                            <b>{ck.word}</b>
                            <span className="font-mono text-[9px] opacity-60">({ck.count})</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Transactions logs list (up to 100 queries) */}
              <div className="p-4 bg-[#1e1a17] rounded-xl border border-[#c9a227]/10">
                <div className="pb-3 border-b border-[#c9a227]/5 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wider">
                    رصد الأسئلة المباشرة (آخر 100 استفسار منشور)
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">آخر تحديث مباشر: {new Date().toLocaleTimeString('ar-SY')}</span>
                </div>

                {analytics.recentLogs.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">لا يوجد سجل تاريخي للاستفسارات بالدردشة حالياً.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto max-h-[300px] space-y-2 pr-1">
                    {analytics.recentLogs.slice(0, 100).map((log) => (
                      <div 
                        key={log.id} 
                        className="p-2.5 bg-[#251e1b] hover:bg-[#2e2622] text-xs flex flex-wrap gap-2 items-center justify-between rounded-lg border border-[#c9a227]/5 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-mono text-[10px] shrink-0">{log.timestamp}</span>
                          <span className="font-semibold text-gray-200 line-clamp-1 max-w-sm">{log.question}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.resolvedLocally ? (
                            <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-950 font-bold px-2 py-0.5 rounded shadow-sm">
                              رد محلي فوري (Instant Match)
                            </span>
                          ) : (
                            <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-950 font-bold px-2 py-0.5 rounded shadow-sm">
                              الربط والتحليل السحابي المتقدم
                            </span>
                          )}
                          <span className="text-[9px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded font-mono font-semibold">✓ ناجحة</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* TAB 4: QR CODE POSTER */}
          {activeTab === 'qr' && (
            <div id="tab-qr-container" className="space-y-6">
              <StoreQRCodeWidget settings={settings} />
            </div>
          )}


          {/* TAB 5: GLOBAL SETTINGS PANEL */}
          {activeTab === 'settings' && (
            <div id="tab-settings-container" className="space-y-6">
              <div className="border-b border-[#c9a227]/10 pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#c9a227]" />
                  تهيئة الفرع وهوية الزبائن
                </h2>
                <p className="text-xs text-gray-400 mt-1">ضبط الإعدادات الشاملة للمحل ومعلومات التواصل وصياغة نص الترحيب ومفاتيح الاتصال.</p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-5 bg-[#1e1a17] p-6 rounded-2xl border border-[#c9a227]/10 max-w-2xl">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Store Name input */}
                  <div>
                    <label className="block text-xs text-[#c9a227] font-semibold mb-2">اسم المتجر العام</label>
                    <input 
                      type="text" 
                      value={localSettings.storeName}
                      onChange={(e) => setLocalSettings({...localSettings, storeName: e.target.value})}
                      className="w-full text-xs p-3 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
                      required
                    />
                  </div>

                  {/* Simulated Logo selection url */}
                  <div>
                    <label className="block text-xs text-[#c9a227] font-semibold mb-2">رابط صورة شعار المتجر (Logo URL)</label>
                    <input 
                      type="text" 
                      value={localSettings.logoUrl || ""}
                      placeholder="https://images.unsplash.com/..."
                      onChange={(e) => setLocalSettings({...localSettings, logoUrl: e.target.value})}
                      className="w-full text-xs p-3 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
                    />
                  </div>
                </div>

                {/* Welcome MSG textarea */}
                <div>
                  <label className="block text-xs text-[#c9a227] font-semibold mb-2">رسالة الترحيب التلقائية بالزبائن</label>
                  <textarea 
                    value={localSettings.welcomeMessage}
                    onChange={(e) => setLocalSettings({...localSettings, welcomeMessage: e.target.value})}
                    className="w-full text-xs p-3 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#c9a227] h-20 leading-relaxed"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Store phone number */}
                  <div>
                    <label className="block text-xs text-[#c9a227] font-semibold mb-2">هاتف الاتصال بالمتجر</label>
                    <input 
                      type="text" 
                      value={localSettings.phone}
                      onChange={(e) => setLocalSettings({...localSettings, phone: e.target.value})}
                      className="w-full text-xs p-3 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#c9a227] font-mono"
                    />
                  </div>

                  {/* Store WhatsApp handling handle */}
                  <div>
                    <label className="block text-xs text-[#c9a227] font-semibold mb-2">رقم الواتساب الرسمي (مبدوءاً بالرمز الدولي)</label>
                    <input 
                      type="text" 
                      value={localSettings.whatsApp}
                      onChange={(e) => setLocalSettings({...localSettings, whatsApp: e.target.value})}
                      className="w-full text-xs p-3 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#c9a227] font-mono"
                    />
                  </div>
                </div>

                {/* Store address physical loc */}
                <div>
                  <label className="block text-xs text-[#c9a227] font-semibold mb-2">العنوان الجغرافي للمحل المطبوع</label>
                  <input 
                    type="text" 
                    value={localSettings.address}
                    onChange={(e) => setLocalSettings({...localSettings, address: e.target.value})}
                    className="w-full text-xs p-3 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
                  />
                </div>

                {/* Secret masked sync token input for client override */}
                <div>
                  <label className="block text-xs text-[#c9a227] font-semibold mb-2">
                    الرمز الرقمي المفتوح للمزامنة وبناء محرك الاستعلام التلقائي
                  </label>
                  <input 
                    type="password" 
                    value={localSettings.geminiAPIKey}
                    placeholder="مضمن ومسجل بشكل آمن في الخادم الداخلي للبرنامج..."
                    onChange={(e) => setLocalSettings({...localSettings, geminiAPIKey: e.target.value})}
                    className="w-full text-xs p-3 bg-[#2a2421] text-[#c9a227] border border-[#c9a227]/25 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#c9a227]/40 placeholder:text-gray-600 block"
                    disabled
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block mr-1 leading-relaxed">
                    ملاحظة: يتم تخزين وتشفير هذا الرمز تلقائياً في السيرفر لضمان موثوقية الإسناد والمزامنة الدائمة.
                  </span>
                </div>

                {/* submit triggers */}
                <div className="pt-4 border-t border-[#c9a227]/10 flex justify-end">
                  <button
                    type="submit"
                    className="bg-gradient-to-l from-[#6B1E1E] to-[#882a2a] hover:from-[#882a2a] hover:to-[#6B1E1E] text-white text-xs font-bold py-3 pr-6 pl-6 rounded-xl border border-[#c9a227]/40 cursor-pointer shadow-md transition transform active:scale-[0.98]"
                  >
                    حفظ ومزامنة وتحديث البيانات
                  </button>
                </div>
              </form>

              {/* Danger Zone: Reset and Delete All Data */}
              <div className="mt-8 bg-[#1e1a17]/50 rounded-2xl border border-red-900/30 p-6 max-w-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-[3px] bg-red-800" />
                <h3 className="text-sm font-extrabold text-red-400 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  منطقة خطر اختيارية: تصفير وتطهير جميع بيانات المتجر
                </h3>
                <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
                  تنبيه: سيؤدي الضغط على الزر أدناه إلى تدمير وتصفير كافة السجلات بشكل فوري. سيتم حذف جميع البضائع المقيدة، دليل الرد التلقائي، إحصائيات الدردشة والتوجيهات المعرفية وسجل حوارات الزبائن، وإعادة تهيئة إعدادات صالة العرض بالكامل. لا يمكن التراجع عن هذا الإجراء مطلقاً بعد تنفيذه.
                </p>
                <button
                  type="button"
                  onClick={onResetDatabase}
                  className="bg-[#6B1E1E]/20 hover:bg-[#6B1E1E]/40 border border-red-500/25 text-red-300 hover:text-white text-xs font-black py-3 px-6 rounded-xl cursor-pointer shadow-md transition transform active:scale-[0.98] w-full md:w-auto text-center"
                >
                  🗑️ تصفير وإعادة تهيئة المتجر وحذف السجلات نهائياً
                </button>
              </div>
            </div>
          )}

        </div>
      </div>


      {/* MODAL WINDOWS FOR PRODUCTS AND KNOWLEDGEBASE COMPILATION */}
      {showProductModal && (
        <div id="product-form-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#1e1a17] text-[#fdfbf7] p-6 rounded-2xl border-2 border-[#c9a227]/50 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#c9a227]/20 pb-3">
              <h3 className="text-sm font-extrabold text-[#c9a227]">
                {editingProduct ? "تحديث ببيانات المنتج الحالي" : "تسجيل وإضافة منتج جديد للمخازن"}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowProductModal(false)}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs font-semibold">
              <div className="space-y-3">
                
                {/* Product spec name */}
                <div>
                  <label className="block text-gray-400 mb-1">اسم البضاعة / المنتج</label>
                  <input 
                    type="text"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="مثل: آيفون 15 برو ماكس السوري..."
                    className="w-full p-2.5 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none"
                    required
                  />
                </div>

                {/* Product describe text */}
                <div>
                  <label className="block text-gray-400 mb-1">وصف موجز للمنتج ومميزاته</label>
                  <textarea 
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="اذكر المواصفات والألوان المتوفرة..."
                    className="w-full p-2.5 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none h-16"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Prices USD */}
                  <div>
                    <label className="block text-gray-400 mb-1">السعر المرجعي (USD)</label>
                    <input 
                      type="number"
                      step="any"
                      value={prodPriceUSD}
                      onChange={(e) => handleUSDPriceChange(Number(e.target.value))}
                      className="w-full p-2.5 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none font-mono"
                      required
                      min="0"
                    />
                  </div>

                  {/* Prices SYP */}
                  <div>
                    <label className="block text-gray-400 mb-1">السعر بالليرة السورية (SYP)</label>
                    <input 
                      type="number"
                      value={prodPriceSYP}
                      onChange={(e) => setProdPriceSYP(Number(e.target.value))}
                      className="w-full p-2.5 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none font-mono"
                      required
                      min="0"
                    />
                    <span className="text-[9px] text-gray-500 mt-1 block">محسوب بقيمة صرف الرقة الموازية المتوقعة.</span>
                  </div>
                </div>

                {/* Availability status selectors */}
                <div>
                  <label className="block text-gray-400 mb-1">حالة توفر المنتج</label>
                  <select
                    value={prodStatus}
                    onChange={(e) => setProdStatus(e.target.value as Product['status'])}
                    className="w-full p-2.5 bg-[#2a2421] text-[#fdfbf7] border border-[#c9a227]/20 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="available">🟢 متوفر للبيع والتسليم فوراً</option>
                    <option value="unavailable">🔴 غير متوفر للبيع حالياً</option>
                    <option value="out_of_stock">🟡 نفد من المخزون وجاري التوريد</option>
                  </select>
                </div>

                {/* Custom key value properties compiler */}
                <div className="pt-2 border-t border-[#c9a227]/10">
                  <label className="block text-[#c9a227] font-semibold mb-1">مواصفات إضافية مخصصة (مثل اللون والمقاس)</label>
                  
                  {/* Active attribute chips list inside popup */}
                  {prodAttrs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {prodAttrs.map((at, index) => (
                        <span key={index} className="px-2 py-0.5 bg-[#2a2421] rounded text-[10px] text-gray-300 border border-[#c9a227]/10 flex items-center gap-1">
                          <b>{at.key}:</b> {at.value}
                          <button type="button" onClick={() => removeAttribute(index)} className="text-rose-400 hover:text-rose-200 cursor-pointer text-[10px]">×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* attribute inputs line */}
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newAttrKey}
                      onChange={(e) => setNewAttrKey(e.target.value)}
                      placeholder="الخاصية (مثلاً: اللون)" 
                      className="flex-1 p-2 bg-[#2a2421] border border-gray-700 rounded-lg text-xs"
                    />
                    <input 
                      type="text" 
                      value={newAttrVal}
                      onChange={(e) => setNewAttrVal(e.target.value)}
                      placeholder="القيمة (مثلاً: أسود ملكي)" 
                      className="flex-1 p-2 bg-[#2a2421] border border-gray-700 rounded-lg text-xs"
                    />
                    <button 
                      type="button" 
                      onClick={addAttribute}
                      className="px-3 bg-neutral-800 hover:bg-neutral-700 text-[#c9a227] rounded-lg font-bold border border-[#c9a227]/10 cursor-pointer"
                    >
                      + أضف
                    </button>
                  </div>
                </div>

              </div>

              {/* save footer actions */}
              <div className="pt-4 border-t border-[#c9a227]/20 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-xl cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-l from-[#6b1e1e] to-[#912d2d] hover:brightness-110 text-white font-bold rounded-xl border border-[#c9a227]/30 cursor-pointer transition shadow"
                >
                  حفظ وتسجيل التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL WINDOW FOR KB QUESTION INTERFACES */}
      {showKBModal && (
        <div id="kb-form-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#1e1a17] text-[#fdfbf7] p-6 rounded-2xl border-2 border-[#c9a227]/50 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#c9a227]/20 pb-3">
              <h3 className="text-sm font-extrabold text-[#c9a227]">
                {editingKB ? "تحديث السؤال المرجعي وقاعدة البيانات المساعدة" : "تسجيل توجيه معرفي وسؤال جديد للرد الفوري"}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowKBModal(false)}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKB} className="space-y-4 text-xs font-semibold">
              <div className="space-y-3">
                {/* Question */}
                <div>
                  <label className="block text-gray-400 mb-1">صيغة سؤال العميل المتوقعة (امتدادات مطورة)</label>
                  <input 
                    type="text"
                    value={kbQuest}
                    onChange={(e) => setKbQuest(e.target.value)}
                    placeholder="مثال: هل توجد أنواع خالية من السكر؟"
                    className="w-full p-2.5 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none"
                    required
                  />
                </div>

                {/* Fixed Answer advice */}
                <div>
                  <label className="block text-gray-400 mb-1">الرد المعتمد الصارم والصحيح</label>
                  <textarea 
                    value={kbAnsw}
                    onChange={(e) => setKbAnsw(e.target.value)}
                    placeholder="مثل: نعم يا غالي، يتوفر لدينا تشكيلة فاخرة خالية من السكر ومناسبة لمرضى السكري والريجيم بناءً على تصنيعنا اليدوي المتميز."
                    className="w-full p-2.5 bg-[#2a2421] text-white border border-[#c9a227]/20 rounded-xl focus:outline-none h-28 leading-relaxed"
                    required
                  />
                </div>
              </div>

              {/* actions */}
              <div className="pt-4 border-t border-[#c9a227]/20 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowKBModal(false)}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-xl cursor-pointer"
                >
                  إلغاء وإهمال
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-l from-[#6b1e1e] to-[#912d2d] hover:brightness-110 text-white font-bold rounded-xl border border-[#c9a227]/40 cursor-pointer transition shadow"
                >
                  حفظ توجيه لغة الرد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
