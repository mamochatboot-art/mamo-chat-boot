import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Download, FileText, QrCode, RefreshCw, Sparkles, MessageCircle, Info } from "lucide-react";
import { StoreSettings } from "../types";

interface StoreQRCodeWidgetProps {
  settings: StoreSettings;
}

export const StoreQRCodeWidget: React.FC<StoreQRCodeWidgetProps> = ({ settings }) => {
  const chatURL = `${window.location.origin}/chat`;
  
  // Customization States
  const [posterTitle, setPosterTitle] = useState(settings.storeName || "شركة مامو للتجارة");
  const [posterSubtitle, setPosterSubtitle] = useState(
    "استفسر عن الأسعار الفورية، واطلع على توفر المواد في صالة العرض بالرقة، واطلب الحجز المباشر عبر محادثة مساعدنا الذكي!"
  );
  const [qrColor, setQrColor] = useState("#6B1E1E");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [qrDataURL, setQrDataURL] = useState("");
  const [copied, setCopied] = useState(false);

  // Generate QR Code dynamically
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
                  drawMamoFallbackLogo(ctx, logoSize);
                };
              } else {
                drawMamoFallbackLogo(ctx, logoSize);
              }
            };
          }
        } else {
          setQrDataURL(url);
        }
      } catch (err) {
        console.error("QR Code widget rendering error:", err);
      }
    };

    const drawMamoFallbackLogo = (ctx: CanvasRenderingContext2D, logoSize: number) => {
      const x = (600 - logoSize) / 2;
      const y = (600 - logoSize) / 2;
      ctx.fillStyle = "#6B1E1E";
      ctx.beginPath();
      ctx.arc(300, 300, logoSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 60px 'Cairo', 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("M", 300, 305);
      setQrDataURL(ctx.canvas.toDataURL("image/png"));
    };

    generateQR();
  }, [chatURL, qrColor, includeLogo, settings.logoUrl, settings.storeName]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(chatURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Transparent/Pure QR Code
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
    ctx.font = "bold 42px 'Cairo', 'Inter', sans-serif";
    ctx.fillText(posterTitle, 400, 100);

    ctx.font = "bold 18px 'Cairo', 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("بوابة مساعدة العملاء والدردشة الفورية الآلية", 400, 160);

    const qrImg = new Image();
    qrImg.src = qrDataURL;
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
      
      // Draw actual QR code
      ctx.drawImage(qrImg, x, y, qrSize, qrSize);

      ctx.fillStyle = "#1a1716";
      ctx.font = "bold 26px 'Cairo', 'Inter', sans-serif";
      ctx.fillText("امسح الرمز بكاميرا جوالك مباشرة 📲", 400, 860);

      ctx.fillStyle = "#6B1E1E";
      ctx.font = "bold 18px 'Cairo', 'Inter', sans-serif";
      
      // Word wrap subtitle helper
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

      ctx.fillStyle = "#777777";
      ctx.font = "bold 14px 'Cairo', sans-serif";
      ctx.fillText(`العنوان: ${settings.address || "الرقة، سوريا"}  |  واتساب: ${settings.whatsApp || "-"}`, 400, 1085);
      ctx.font = "normal 11px monospace";
      ctx.fillText(`Mamo Automated Chat Assistant • http://localhost:3000`, 400, 1115);

      const downloadImgLink = document.createElement("a");
      downloadImgLink.href = canvas.toDataURL("image/png");
      downloadImgLink.download = `${posterTitle.replace(/\s+/g, '_')}_QR_Poster.png`;
      downloadImgLink.click();
    };
  };

  // Multi-format PDF printing engine using responsive frame printing technology
  const generatePDFPrint = () => {
    let printFrame = document.getElementById("qr-pdf-print-frame") as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement("iframe") as HTMLIFrameElement;
      printFrame.id = "qr-pdf-print-frame";
      printFrame.style.position = "absolute";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "none";
      printFrame.style.visibility = "hidden";
      document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!doc) {
      alert("تعذر تشغيل مستند الطباعة. يرجى تجربة تنزيل نسخة الـ PNG بدلاً من ذلك.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>بوستر QR المعتمد - ${posterTitle}</title>
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
            padding: 24px;
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
            padding: 40px 30px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }
          .header-area {
            background: linear-gradient(135deg, #6B1E1E, #c9a227);
            width: 100%;
            padding: 35px 20px;
            border-radius: 20px;
            text-align: center;
            color: #ffffff;
            box-sizing: border-box;
          }
          .header-area h1 {
            margin: 0;
            font-size: 34px;
            font-weight: 900;
          }
          .header-area p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .qr-wrapper {
            background-color: #ffffff;
            border: 3px solid #6B1E1E;
            padding: 20px;
            border-radius: 24px;
            box-shadow: 0 10px 30px rgba(107,30,30,0.06);
            margin: 40px 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-image {
            width: 320px;
            height: 320px;
            display: block;
          }
          .instructions-wrapper {
            text-align: center;
            max-width: 600px;
            margin-bottom: 20px;
          }
          .instructions-wrapper h2 {
            font-size: 24px;
            color: #1a1716;
            margin: 0 0 15px 0;
            font-weight: 900;
          }
          .instructions-wrapper p {
            font-size: 16px;
            color: #6B1E1E;
            line-height: 1.7;
            font-weight: 700;
            margin: 0;
          }
          .footer-address {
            border-top: 1px dashed rgba(201,162,39,0.5);
            width: 90%;
            padding-top: 20px;
            text-align: center;
            font-size: 14px;
            color: #555555;
            font-weight: 700;
          }
          @media print {
            body {
              background: none;
            }
            .poster-container {
              width: 100%;
              height: 100vh;
              border: 15px solid #c9a227 !important;
              box-sizing: border-box;
            }
          }
        </style>
      </head>
      <body>
        <div class="poster-container">
          <div class="poster-inner-border">
            <div class="header-area">
              <h1>${posterTitle}</h1>
              <p>بوابة مساعدة العملاء والدردشة الفورية الآلية</p>
            </div>
            
            <div class="qr-wrapper">
              <img class="qr-image" src="${qrDataURL}" alt="Customer Support QR">
            </div>

            <div class="instructions-wrapper">
              <h2>امسح الرمز بكاميرا جوالك مباشرة 📲</h2>
              <p>${posterSubtitle}</p>
            </div>

            <div class="footer-address">
              <span>📍 العنوان: ${settings.address || "الرقة، سوريا"}</span>
              <span style="margin: 0 15px;">•</span>
              <span>💬 واتس التواصل: ${settings.whatsApp || "-"}</span>
              <br>
              <span style="font-size: 11px; font-family: monospace; opacity: 0.7; display: inline-block; margin-top: 8px;">
                مامو للتجارة والخدمات الرقمية • تم التصدير بصيغة PDF قابلة للطباعة المباشرة
              </span>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Trigger printing inside iframe context seamlessly
    setTimeout(() => {
      printFrame.contentWindow?.focus();
    }, 200);
  };

  return (
    <div className="bg-[#1a1716] text-[#fdfbf7] p-6 rounded-2xl border border-[#c9a227]/10 shadow-lg max-w-5xl mx-auto space-y-6">
      
      <div className="border-b border-[#c9a227]/15 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-[#c9a227] flex items-center gap-2">
            <QrCode className="w-5.5 h-5.5" />
            رمز الـ QR الموحد وبوستر صالة العرض
          </h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xl">
            اعرض رمز الاستجابة السريع الخاص بالـ Chatbot في صالة المعرض أو وزعه على العلب والمنتجات لتمكين الزبائن من مسحه وبدء الاستفسار والمحادثة الذكية فوراً.
          </p>
        </div>
        
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-950 text-emerald-400 font-bold px-3 py-1.5 rounded-full border border-emerald-900/30">
            <Sparkles className="w-3.5 h-3.5 fill-emerald-400/25" />
            توليد فوري تلقائي
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Right Section: Visual Poster Live Preview */}
        <div className="lg:col-span-5 flex flex-col items-center gap-3">
          <span className="text-[10px] text-[#c9a227] font-extrabold tracking-wider bg-[#26211e] px-4 py-1.5 rounded-full border border-[#c9a227]/25 w-full text-center">
            🖼️ المعاينة المباشرة لبوستر الملصق (A4 Poster Preview)
          </span>
          
          <div 
            className="w-full max-w-[280px] bg-white text-[#1a1716] rounded-2xl shadow-xl p-4 flex flex-col justify-between border-[3px] aspect-[1/1.41] select-none relative overflow-hidden transition-all duration-300 transform hover:scale-101 border-dashed"
            style={{ borderColor: qrColor }}
          >
            {/* Soft decorative background circles */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-neutral-100 rounded-bl-full opacity-40 pointers-none" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-neutral-100 rounded-tr-full opacity-40 pointers-none" />

            <div className="w-full relative z-10 text-center space-y-0.5">
              <h4 className="text-sm font-black tracking-tight leading-none uppercase text-[#6B1E1E] truncate" style={{ color: qrColor }}>
                {posterTitle}
              </h4>
              <span className="text-[7.5px] text-[#c9a227] font-black tracking-wider block uppercase">
                MAMO CHATBOT SUPPORT ENGINE
              </span>
            </div>

            {/* Live dynamic QR Code */}
            <div className="my-3 p-2 bg-white border border-neutral-150 rounded-xl shadow-xs self-center relative z-10">
              {qrDataURL ? (
                <img 
                  src={qrDataURL} 
                  alt="Store QR Live" 
                  className="w-32 h-32 object-contain mx-auto"
                />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center bg-gray-50 rounded">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              )}
            </div>

            <div className="text-center space-y-1 relative z-10 px-1">
              <p className="text-[11px] font-black text-neutral-800 leading-none">
                امسح الرمز بكاميرا جوالك مباشرة 📲
              </p>
              <p className="text-[9px] text-gray-500 font-bold leading-tight line-clamp-3">
                {posterSubtitle}
              </p>
            </div>

            {/* Footer aesthetics */}
            <div className="pt-2 border-t border-neutral-150 w-full flex justify-between items-center text-[7px] font-mono text-gray-400 relative z-10">
              <span className="font-sans font-bold">{settings.address || "الرقة، سوريا"}</span>
              <span>Mamo Automated Engine</span>
            </div>
          </div>
        </div>

        {/* Left Section: Advanced Control and Download Panel */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Quick Support Link share */}
          <div className="p-4 bg-[#26211e] rounded-xl border border-[#c9a227]/10 space-y-2">
            <label className="text-[11px] font-bold text-[#c9a227] block uppercase tracking-wider">
              رابط الدردشة المباشر المشفر للرمز
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly
                value={chatURL}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 text-[11px] font-mono px-3 py-2 bg-[#1b1716] border border-[#c9a227]/20 text-emerald-400 rounded-lg focus:outline-none"
              />
              <button 
                type="button"
                onClick={handleCopyLink}
                className="px-3 bg-[#6B1E1E] hover:bg-[#852727] text-white text-xs rounded-lg font-black transition active:scale-95"
              >
                {copied ? "تم النسخ!" : "نسخ الرابط"}
              </button>
            </div>
          </div>

          {/* Interactive Styling Customs */}
          <div className="p-5 bg-[#26211e] rounded-xl border border-[#c9a227]/10 space-y-4">
            <span className="text-xs font-black text-[#c9a227] block pb-2 border-b border-[#c9a227]/10">
              تعديل بيانات وتصميم رمز المتجر
            </span>

            {/* Poster heading */}
            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] font-bold block">العنوان التجاري المطبوع بالملصق</label>
              <input 
                type="text"
                value={posterTitle}
                onChange={(e) => setPosterTitle(e.target.value)}
                placeholder="اسم متجرك أو صالة العرض..."
                className="w-full text-xs p-2.5 bg-[#1b1716] border border-[#c9a227]/15 rounded-lg text-white font-semibold focus:outline-none focus:border-[#c9a227]"
              />
            </div>

            {/* Instruction body */}
            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] font-bold block">نص إرشاد ومساعدة الزبائن بالملصق</label>
              <textarea 
                value={posterSubtitle}
                onChange={(e) => setPosterSubtitle(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#1b1716] border border-[#c9a227]/15 rounded-lg text-white font-medium focus:outline-none focus:border-[#c9a227] h-18 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Dots palette */}
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-bold block">لون رمز الـ QR</label>
                <div className="flex gap-1.5">
                  {[
                    { name: "العنابي", hex: "#6B1E1E" },
                    { name: "الذهبي", hex: "#c9a227" },
                    { name: "الأسود", hex: "#1a1716" }
                  ].map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setQrColor(color.hex)}
                      className={`flex-1 py-2 px-1 rounded-lg border text-[9px] font-extrabold text-center transition ${
                        qrColor === color.hex 
                          ? "border-[#c9a227] bg-[#1a1716] text-[#c9a227]" 
                          : "border-neutral-800 bg-transparent text-gray-400 hover:text-white"
                      }`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1 border border-neutral-700" style={{ backgroundColor: color.hex }} />
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Center logo toggle */}
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-bold block">الشعار في المنتصف</label>
                <button
                  type="button"
                  onClick={() => setIncludeLogo(!includeLogo)}
                  className={`w-full py-2.5 px-3 rounded-lg border text-xs font-bold text-center transition flex justify-center items-center gap-2 select-none ${
                    includeLogo 
                      ? "border-[#c9a227] bg-[#1a1716] text-amber-300 font-black" 
                      : "border-neutral-850 bg-transparent text-gray-500"
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={includeLogo}
                    readOnly
                    className="accent-[#6B1E1E]"
                  />
                  <span>تضمين رمز المتجر المركزي</span>
                </button>
              </div>
            </div>
          </div>

          {/* Downloads Action Panel */}
          <div className="space-y-3 pt-2">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">
              تحميل ومخرجات الطباعة عالية الجودة
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Download PNG Poster */}
              <button
                type="button"
                onClick={downloadPosterPNG}
                className="flex items-center justify-center gap-2 py-3.5 px-4 bg-transparent border border-[#c9a227]/30 hover:bg-neutral-800 text-white rounded-xl text-xs font-black shadow-md transition transform active:scale-98 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#c9a227]" />
                <span>تحميل بوستر PNG بدقة عالية</span>
              </button>

              {/* Download PDF Poster */}
              <button
                type="button"
                onClick={generatePDFPrint}
                className="flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-l from-[#6B1E1E] to-[#882b2b] hover:from-[#852727] hover:to-[#a03434] text-white rounded-xl text-xs font-black shadow-md transition transform active:scale-98 cursor-pointer border border-[#c9a227]/10"
              >
                <FileText className="w-4.5 h-4.5 text-[#c9a227]" />
                <span>تحميل بوستر PDF للطباعة (A4)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Pure Transparent QR download only */}
              <button
                type="button"
                onClick={downloadPureQR}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-transparent hover:bg-neutral-850 border border-neutral-800 rounded-xl text-[11px] text-gray-300 font-bold transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>تحميل رمز الـ QR ناصعاً بشكل منفصل (PNG)</span>
              </button>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 leading-normal flex items-start gap-1 p-2 bg-[#26211e]/40 rounded-lg">
            <Info className="w-3.5 h-3.5 shrink-0 text-[#c9a227] mt-0.5" />
            <span>
              نصيحة الطباعة: لضمان مظهر فاخر ومثالي في صالة العرض الخاصة بك بالرقة، يوصى بطباعة ملف الـ **PDF** على ورق مقوى ومصقول بوزن **250 جرام** على الأقل (نص غير لامع Matte)، ووضعه في حامل أكريليك شفاف بمقاس A4 بجوار منطقة العرض والمحاسبة.
            </span>
          </p>

        </div>
      </div>
    </div>
  );
};
