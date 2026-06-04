/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, Store, KeyRound } from "lucide-react";

interface LoginGateProps {
  onLoginSuccess: () => void;
}

export default function LoginGate({ onLoginSuccess }: LoginGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check local storage for persistent login session
    const isLogged = localStorage.getItem("mamo_merchant_logged_in");
    if (isLogged === "true") {
      onLoginSuccess();
    }
  }, [onLoginSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Gatekeeper password is simple string validation.
    const expectedPassword = "MAMOCOMPANY225@#$X";

    if (password === expectedPassword) {
      if (rememberMe) {
        localStorage.setItem("mamo_merchant_logged_in", "true");
      }
      onLoginSuccess();
    } else {
      setError("عذراً، كلمة المرور غير صحيحة! يرجى إدخال كلمة مرور المدير الصحيحة.");
    }
  };

  return (
    <div className="flex min-h-[600px] items-center justify-center p-4 bg-radial from-[#3a0d0d] to-[#140404]">
      <div 
        id="login-card"
        className="w-full max-w-md p-8 bg-[#1e1a17] rounded-2xl border-2 border-[#c9a227]/30 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-[#6B1E1E] via-[#c9a227] to-[#6B1E1E]" />

        {/* Store Decorative Logo Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#6b1e1e] to-[#c9a227] flex items-center justify-center border-2 border-[#c9a227]/60 shadow-lg mb-4">
            <Store className="w-8 h-8 text-[#fdfbf7]" />
          </div>
          <h1 className="text-2xl font-bold text-[#fdfbf7] tracking-tight">متجر مامو</h1>
          <p className="text-[#c9a227] text-sm mt-1 font-semibold">بوابة تسجيل دخول التاجر لإدارة الفروع</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[#fdfbf7]/80 text-sm font-medium mb-2 mr-1">
              أدخل كلمة مرور مدير المتجر
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#c9a227]">
                <KeyRound className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة مرور المدير..."
                className="w-full pl-12 pr-10 py-3 bg-[#2a2421] text-[#fdfbf7] border border-[#c9a227]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c9a227]/70 text-center font-mono placeholder:text-[#fdfbf7]/30"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#c9a227]/60 hover:text-[#c9a227]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-reverse space-x-2 text-xs text-[#fdfbf7]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#6B1E1E] focus:ring-[#6B1E1E] bg-[#2a2421] accent-[#c9a227]"
              />
              <span>تذكرني على هذا الجهاز (تسجيل دخول دائم)</span>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-red-200 text-xs text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            id="login-btn"
            className="w-full py-3 bg-gradient-to-l from-[#6b1e1e] to-[#912d2d] hover:from-[#912d2d] hover:to-[#6b1e1e] text-[#fdfbf7] font-bold rounded-xl border border-[#c9a227]/50 shadow-md transition-all duration-300 transform active:scale-[0.98] cursor-pointer"
          >
            دخول للوحة التحكم الآمنة
          </button>
        </form>
      </div>
    </div>
  );
}
