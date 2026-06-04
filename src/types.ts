/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  priceUSD: number;
  priceSYP: number;
  status: 'available' | 'unavailable' | 'out_of_stock'; // متوفر، غير متوفر، نفد من المخزون
  attributes: ProductAttribute[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgePair {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StoreSettings {
  storeName: string;
  logoUrl?: string;
  welcomeMessage: string;
  phone: string;
  whatsApp: string;
  address: string;
  geminiAPIKey: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  matchedProduct?: Product;
  isFallback?: boolean;
}

export interface ChatSession {
  id: string;
  customerName: string;
  phone?: string;
  messages: ChatMessage[];
  createdAt: string;
  lastActive: string;
}

export interface AnalyticsSummary {
  totalConversations: number;
  frequentQuestions: Array<{ question: string; count: number }>;
  commonKeywords: Array<{ word: string; count: number }>;
  recentLogs: Array<{
    id: string;
    question: string;
    resolvedLocally: boolean;
    timestamp: string;
    rating?: number; // evaluation of response
  }>;
}

export type NetworkStatus = 'connected' | 'offline' | 'syncing';
