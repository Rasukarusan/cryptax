"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Check,
  DollarSign,
  Edit2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import Papa from "papaparse";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface Transaction {
  date: Date;
  type: string;
  amount: number;
  price: number;
  fee: number;
  jpyAmount: number;
}

interface PurchaseLot {
  date: Date;
  amount: number;
  unitPrice: number;
  totalCost: number;
}

interface CurrencyData {
  transactions: Transaction[];
  totalBought: number;
  totalSold: number;
  totalDeposited: number;
  totalSent: number;
  currentHoldings: number;
  totalCost: number;
  totalRevenue: number;
  realizedPnL: number;
  lastPrice: number;
  purchaseLots: PurchaseLot[];
  averagePrice: number;
  currentCost: number;
}

interface ProcessedData {
  currencyData: Record<string, CurrencyData>;
  totalDeposit: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

const CryptoTaxCalculator = () => {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(
    {},
  );
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");
  const [pricesLoaded, setPricesLoaded] = useState(false);

  // Binance APIから価格を取得
  const fetchBinancePrices = async () => {
    if (!data) return;

    try {
      // 通貨リストを取得
      const currencies = Object.keys(data.currencyData);

      // BinanceとYahoo FinanceのAPIから価格を取得
      const [binanceResponse, usdResponse] = await Promise.all([
        fetch(`/api/binance?symbols=${currencies.join(",")}`),
        fetch("/api/yahoo-finance/usd"),
      ]);

      const binanceData = await binanceResponse.json();
      const usdData = await usdResponse.json();
      
      // デバッグ情報を出力
      console.log("Binance API response:", binanceData);
      console.log("USD/JPY API response:", usdData);

      const newPrices: Record<string, number> = {};

      if (
        binanceData.result &&
        binanceData.prices &&
        usdData.result &&
        usdData.price
      ) {
        const usdToJpy = usdData.price;

        // USD価格を円に変換
        Object.entries(data.currencyData).forEach(([currency, currData]) => {
          const usdPrice = binanceData.prices[currency];
          if (usdPrice) {
            newPrices[currency] = usdPrice * usdToJpy;
            console.log(
              `${currency}: $${usdPrice} × ¥${usdToJpy} = ¥${(usdPrice * usdToJpy).toLocaleString()}`,
            );
          } else if (currData.lastPrice > 0) {
            // APIから取得できない場合は最後の取引価格を使用
            newPrices[currency] = currData.lastPrice;
            console.log(
              `${currency}: 最後の取引価格 ¥${currData.lastPrice.toLocaleString()}`,
            );
          }
        });

        setCurrentPrices(newPrices);
        setPricesLoaded(true);
        console.log("現在価格を更新しました");
      } else {
        // APIエラーの場合は最後の取引価格を使用
        const fallbackPrices: Record<string, number> = {};
        Object.entries(data.currencyData).forEach(([currency, currData]) => {
          if (currData.lastPrice > 0) {
            fallbackPrices[currency] = currData.lastPrice;
          }
        });
        setCurrentPrices(fallbackPrices);
        setPricesLoaded(true);
        console.warn(
          "価格の取得に失敗しました。最後の取引価格を表示しています。",
        );
      }
    } catch (error) {
      console.error("価格取得エラー:", error);
      console.warn("価格の取得に失敗しました。手動で価格を入力してください。");
      setPricesLoaded(true);
    }
  };

  const processCSVData = (csvData: any[]): ProcessedData => {
    const currencyData: Record<string, CurrencyData> = {};
    let totalDeposit = 0;
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    csvData.forEach((row) => {
      const currency = row["通貨1"];
      const type = row["取引種別"];
      const amount =
        parseFloat(String(row["通貨1数量"] || "0").replace(/,/g, "")) || 0;
      const price =
        parseFloat(String(row["取引価格"] || "0").replace(/,/g, "")) || 0;
      const fee = parseFloat(row["手数料"] || "0") || 0;
      const jpyAmount =
        parseFloat(String(row["通貨2数量"] || "0").replace(/,/g, "")) || 0;
      const date = new Date(row["取引日時"]);
      
      // 期間の記録
      if (!isNaN(date.getTime())) {
        if (!startDate || date < startDate) {
          startDate = date;
        }
        if (!endDate || date > endDate) {
          endDate = date;
        }
      }

      // JPY入金を除外
      if (currency === "JPY") {
        if (type === "入金") {
          totalDeposit += Math.abs(jpyAmount || amount);
        }
        return;
      }

      if (!currencyData[currency]) {
        currencyData[currency] = {
          transactions: [],
          totalBought: 0,
          totalSold: 0,
          totalDeposited: 0,
          totalSent: 0,
          currentHoldings: 0,
          totalCost: 0,
          totalRevenue: 0,
          realizedPnL: 0,
          lastPrice: 0,
          purchaseLots: [],
          averagePrice: 0,
          currentCost: 0,
        };
      }

      currencyData[currency].transactions.push({
        date,
        type,
        amount: Math.abs(amount),
        price,
        fee: Math.abs(fee),
        jpyAmount: Math.abs(jpyAmount),
      });

      // 最新の取引価格を記録
      if (price > 0 && (type === "買い" || type === "売り")) {
        currencyData[currency].lastPrice = price;
      }
    });

    // 各通貨の計算（LIFO法）
    Object.keys(currencyData).forEach((currency) => {
      const data = currencyData[currency];
      // 日付順にソート
      data.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      data.transactions.forEach((t) => {
        if (t.type === "買い") {
          const netAmount = t.amount - t.fee;
          const unitPrice = t.jpyAmount / netAmount;

          // 購入ロットをスタックに追加（LIFO用）
          data.purchaseLots.push({
            date: t.date,
            amount: netAmount,
            unitPrice: unitPrice,
            totalCost: t.jpyAmount,
          });

          data.totalBought += t.amount;
          data.totalCost += t.jpyAmount;
        } else if (t.type === "売り") {
          let remainingSellAmount = t.amount + t.fee; // 売却数量＋手数料
          let sellCost = 0;

          // LIFO法：最新のロットから取り崩す
          while (remainingSellAmount > 0 && data.purchaseLots.length > 0) {
            const lastLot = data.purchaseLots[data.purchaseLots.length - 1];

            if (lastLot.amount <= remainingSellAmount) {
              // ロット全体を売却
              sellCost += lastLot.amount * lastLot.unitPrice;
              remainingSellAmount -= lastLot.amount;
              data.purchaseLots.pop();
            } else {
              // ロットの一部を売却
              sellCost += remainingSellAmount * lastLot.unitPrice;
              lastLot.amount -= remainingSellAmount;
              lastLot.totalCost = lastLot.amount * lastLot.unitPrice;
              remainingSellAmount = 0;
            }
          }

          // 実現損益の計算（売却収入 - 売却原価）
          const profit =
            t.jpyAmount - (sellCost * t.amount) / (t.amount + t.fee);

          data.totalSold += t.amount;
          data.totalRevenue += t.jpyAmount;
          data.realizedPnL += profit;
        } else if (t.type === "入金") {
          // 入金は取得価格0円として追加
          data.purchaseLots.push({
            date: t.date,
            amount: t.amount,
            unitPrice: 0,
            totalCost: 0,
          });

          data.totalDeposited += t.amount;
        } else if (t.type === "外部送付") {
          let remainingSendAmount = t.amount + t.fee;

          // LIFO法：最新のロットから取り崩す
          while (remainingSendAmount > 0 && data.purchaseLots.length > 0) {
            const lastLot = data.purchaseLots[data.purchaseLots.length - 1];

            if (lastLot.amount <= remainingSendAmount) {
              remainingSendAmount -= lastLot.amount;
              data.purchaseLots.pop();
            } else {
              lastLot.amount -= remainingSendAmount;
              lastLot.totalCost = lastLot.amount * lastLot.unitPrice;
              remainingSendAmount = 0;
            }
          }

          data.totalSent += t.amount;
        }
      });

      // 現在の保有数量と取得価格を計算
      data.currentHoldings = 0;
      data.currentCost = 0;

      data.purchaseLots.forEach((lot) => {
        data.currentHoldings += lot.amount;
        data.currentCost += lot.totalCost;
      });

      data.averagePrice =
        data.currentHoldings > 0 ? data.currentCost / data.currentHoldings : 0;
    });

    // 初期価格を設定（最後の取引価格を使用）
    const initialPrices: Record<string, number> = {};
    Object.entries(currencyData).forEach(([currency, data]) => {
      if (data.lastPrice > 0) {
        initialPrices[currency] = data.lastPrice;
      }
    });
    setCurrentPrices(initialPrices);

    return { currencyData, totalDeposit, dateRange: { start: startDate, end: endDate } };
  };

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setLoading(true);
      setFileName(file.name);

      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setPricesLoaded(false);
          const processed = processCSVData(results.data);
          setData(processed);
          setLoading(false);
        },
        error: (error) => {
          console.error("CSV parse error:", error);
          setLoading(false);
          alert("CSVファイルの読み込みに失敗しました");
        },
      });
    },
    [],
  );

  // データ読み込み後、自動的に最新価格を取得
  useEffect(() => {
    if (data) {
      // まず最後の取引価格を設定
      const initialPrices: Record<string, number> = {};
      Object.entries(data.currencyData).forEach(([currency, currData]) => {
        if (currData.lastPrice > 0) {
          initialPrices[currency] = currData.lastPrice;
        }
      });
      setCurrentPrices(initialPrices);

      // その後、APIから最新価格を取得
      fetchBinancePrices();
    }
  }, [data]);

  const formatNumber = (num: number, decimals = 0) => {
    if (Math.abs(num) < 0.01 && num !== 0) {
      return num.toFixed(8);
    }
    return num.toLocaleString("ja-JP", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatCurrency = (num: number) => {
    return `¥${formatNumber(Math.round(num))}`;
  };

  const calculateTotalPnL = () => {
    if (!data) return 0;
    return Object.values(data.currencyData).reduce(
      (sum, curr) => sum + curr.realizedPnL,
      0,
    );
  };

  const calculateUnrealizedPnL = (currency: string, currData: CurrencyData) => {
    const currentPrice = currentPrices[currency] || 0;
    const currentValue = currData.currentHoldings * currentPrice;
    return currentValue - currData.currentCost;
  };

  const calculateTotalUnrealizedPnL = () => {
    if (!data) return 0;
    return Object.entries(data.currencyData).reduce((sum, [currency, curr]) => {
      return sum + calculateUnrealizedPnL(currency, curr);
    }, 0);
  };
  
  // 現在の総資産額を計算（現在価格での評価額）
  const calculateTotalAssets = () => {
    if (!data) return 0;
    return Object.entries(data.currencyData).reduce((sum, [currency, curr]) => {
      const currentPrice = currentPrices[currency] || 0;
      return sum + (curr.currentHoldings * currentPrice);
    }, 0);
  };
  
  // 現在保有している日本円を計算
  const calculateCurrentCash = () => {
    if (!data) return 0;
    // 総入金額 + 売却収入 - 購入費用 - 手数料
    const totalRevenue = Object.values(data.currencyData).reduce((sum, curr) => sum + curr.totalRevenue, 0);
    const totalCost = Object.values(data.currencyData).reduce((sum, curr) => sum + curr.totalCost, 0);
    return data.totalDeposit + totalRevenue - totalCost;
  };
  
  // 手数料の総合計を計算（円換算）
  const calculateTotalFees = () => {
    if (!data) return 0;
    return Object.entries(data.currencyData).reduce((sum, [currency, curr]) => {
      const currentPrice = currentPrices[currency] || curr.lastPrice || 0;
      // 各取引の手数料を円換算して合計
      const feesInCrypto = curr.transactions.reduce((feeSum, t) => {
        // 買い・売りの場合は手数料は仮想通貨単位、外部送付の場合も仮想通貨単位
        if (t.type === '買い' || t.type === '売り') {
          // 買い・売りの手数料は既に取引価格に反映されているため、手数料×価格で計算
          return feeSum + (t.fee * t.price);
        } else if (t.type === '外部送付') {
          // 外部送付の手数料は現在価格で換算
          return feeSum + (t.fee * currentPrice);
        }
        return feeSum;
      }, 0);
      return sum + feesInCrypto;
    }, 0);
  };

  // 累進課税に基づく税額計算
  const calculateTax = (income: number) => {
    if (income <= 0) return 0;
    
    // 税率テーブル
    const taxBrackets = [
      { min: 0, max: 1949000, rate: 0.05, deduction: 0 },
      { min: 1950000, max: 3299000, rate: 0.10, deduction: 97500 },
      { min: 3300000, max: 6949000, rate: 0.20, deduction: 427500 },
      { min: 6950000, max: 8999000, rate: 0.23, deduction: 636000 },
      { min: 9000000, max: 17999000, rate: 0.33, deduction: 1536000 },
      { min: 18000000, max: 39999000, rate: 0.40, deduction: 2796000 },
      { min: 40000000, max: Infinity, rate: 0.45, deduction: 4796000 },
    ];
    
    // 該当する税率区分を見つける
    const bracket = taxBrackets.find(b => income >= b.min && income <= b.max);
    if (!bracket) return 0;
    
    // 税額 = 所得 × 税率 - 控除額
    return income * bracket.rate - bracket.deduction;
  };
  
  // 税率を取得（表示用）
  const getTaxRate = (income: number) => {
    if (income <= 0) return 0;
    if (income <= 1949000) return 5;
    if (income <= 3299000) return 10;
    if (income <= 6949000) return 20;
    if (income <= 8999000) return 23;
    if (income <= 17999000) return 33;
    if (income <= 39999000) return 40;
    return 45;
  };

  const startEditPrice = (currency: string) => {
    setEditingPrice(currency);
    setTempPrice(currentPrices[currency]?.toString() || "");
  };

  const savePrice = (currency: string) => {
    const newPrice = parseFloat(tempPrice) || 0;
    setCurrentPrices((prev) => ({
      ...prev,
      [currency]: newPrice,
    }));
    setEditingPrice(null);
  };

  const cancelEdit = () => {
    setEditingPrice(null);
    setTempPrice("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            仮想通貨税計算ツール
          </h1>
          <p className="text-gray-300">
            CSVファイルをアップロードして損益を自動計算
          </p>
          <p className="text-blue-400 text-sm mt-1">
            計算方法: LIFO法（後入先出法）
          </p>
          {data && data.dateRange.start && data.dateRange.end && (
            <p className="text-gray-400 text-sm mt-1">
              算出期間: {data.dateRange.start.toLocaleDateString('ja-JP')} 〜 {data.dateRange.end.toLocaleDateString('ja-JP')}
            </p>
          )}
        </div>

        {!data ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 text-center">
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center space-y-4">
                <Upload className="w-16 h-16 text-blue-400" />
                <div>
                  <p className="text-xl font-semibold text-white mb-2">
                    CSVファイルをアップロード
                  </p>
                  <p className="text-gray-400 text-sm">
                    クリックしてファイルを選択
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
              </div>
            </label>
            {loading && (
              <div className="mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                <p className="text-white mt-2">処理中...</p>
              </div>
            )}
          </div>
        ) : !pricesLoaded ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-xl mb-2">価格情報を取得中...</p>
            <p className="text-gray-400 text-sm">しばらくお待ちください</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Binance価格取得ボタン */}
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">
                現在価格は手動で編集可能（価格をクリック）
              </p>
              <button
                onClick={fetchBinancePrices}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg transition-colors text-white"
              >
                <RefreshCw className="w-4 h-4" />
                <span>最新価格を取得</span>
              </button>
            </div>

            {/* サマリーカード - 上段 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">総入金額</span>
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(data.totalDeposit)}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">日本円残高</span>
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-cyan-400">
                  {formatCurrency(calculateCurrentCash())}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  取引所内
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">仮想通貨評価額</span>
                  <Wallet className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  {formatCurrency(calculateTotalAssets())}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  現在価格
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">手数料合計</span>
                  <TrendingDown className="w-5 h-5 text-orange-400" />
                </div>
                <p className="text-2xl font-bold text-orange-400">
                  {formatCurrency(calculateTotalFees())}
                </p>
              </div>
            </div>

            {/* サマリーカード - 下段 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">実現損益</span>
                  {calculateTotalPnL() >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <p
                  className={`text-2xl font-bold ${calculateTotalPnL() >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {formatCurrency(calculateTotalPnL())}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">含み損益</span>
                  {calculateTotalUnrealizedPnL() >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-orange-400" />
                  )}
                </div>
                <p
                  className={`text-2xl font-bold ${calculateTotalUnrealizedPnL() >= 0 ? "text-blue-400" : "text-orange-400"}`}
                >
                  {formatCurrency(calculateTotalUnrealizedPnL())}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">
                    推定税額（{getTaxRate(calculateTotalPnL() + calculateTotalUnrealizedPnL())}%）
                  </span>
                  <BarChart3 className="w-5 h-5 text-yellow-400" />
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatCurrency(calculateTax(calculateTotalPnL() + calculateTotalUnrealizedPnL()))}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  累進課税適用
                </p>
              </div>
            </div>

            {/* 総合計 */}
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 mb-1">総合計損益（実現＋含み、手数料込）</p>
                  <p
                    className={`text-3xl font-bold ${(calculateTotalPnL() + calculateTotalUnrealizedPnL()) >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {formatCurrency(
                      calculateTotalPnL() + calculateTotalUnrealizedPnL(),
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm mb-1">総資産額</p>
                  <p className="text-2xl font-bold text-white mb-2">
                    {formatCurrency(calculateCurrentCash() + calculateTotalAssets())}
                  </p>
                  <p className="text-gray-400 text-sm">損益内訳</p>
                  <p className="text-white text-sm">
                    実現: {formatCurrency(calculateTotalPnL())}
                  </p>
                  <p className="text-white text-sm">
                    含み: {formatCurrency(calculateTotalUnrealizedPnL())}
                  </p>
                  <p className="text-white text-sm">
                    手数料: -{formatCurrency(calculateTotalFees())}
                  </p>
                </div>
              </div>
            </div>

            {/* 通貨別詳細 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
              <div className="px-6 py-4 bg-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  通貨別詳細（LIFO法）
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  現在価格は自動取得または手動編集可能
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-white/10">
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        通貨
                      </th>
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        購入量
                      </th>
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        売却量
                      </th>
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        保有量
                      </th>
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        平均取得価格
                        <br />
                        <span className="text-xs font-normal">
                          (残存ロット)
                        </span>
                      </th>
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        現在価格
                      </th>
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        実現損益
                      </th>
                      <th className="px-6 py-3 text-gray-300 font-medium text-sm">
                        含み損益
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.currencyData)
                      .filter(
                        ([_, curr]) =>
                          curr.totalBought > 0 ||
                          curr.totalSold > 0 ||
                          curr.currentHoldings > 0,
                      )
                      .sort(
                        (a, b) =>
                          Math.abs(b[1].realizedPnL) -
                          Math.abs(a[1].realizedPnL),
                      )
                      .map(([currency, curr]) => {
                        const unrealizedPnL = calculateUnrealizedPnL(
                          currency,
                          curr,
                        );
                        return (
                          <tr
                            key={currency}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <span className="font-semibold text-white">
                                {currency}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <ArrowDownCircle className="w-4 h-4 text-green-400" />
                                <span className="text-gray-300">
                                  {formatNumber(curr.totalBought, 4)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <ArrowUpCircle className="w-4 h-4 text-blue-400" />
                                <span className="text-gray-300">
                                  {formatNumber(curr.totalSold, 4)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-white font-medium">
                                {formatNumber(curr.currentHoldings, 6)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-300">
                                {curr.averagePrice > 0
                                  ? formatCurrency(curr.averagePrice)
                                  : "-"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {editingPrice === currency ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={tempPrice}
                                    onChange={(e) =>
                                      setTempPrice(e.target.value)
                                    }
                                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => savePrice(currency)}
                                    className="p-1 hover:bg-green-500/20 rounded"
                                  >
                                    <Check className="w-4 h-4 text-green-400" />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="p-1 hover:bg-red-500/20 rounded"
                                  >
                                    <X className="w-4 h-4 text-red-400" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditPrice(currency)}
                                  className="flex items-center gap-1 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                                >
                                  <span className="text-gray-300">
                                    {currentPrices[currency]
                                      ? formatCurrency(currentPrices[currency])
                                      : "未設定"}
                                  </span>
                                  <Edit2 className="w-3 h-3 text-gray-400" />
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`font-semibold ${curr.realizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {formatCurrency(curr.realizedPnL)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`font-semibold ${unrealizedPnL >= 0 ? "text-blue-400" : "text-orange-400"}`}
                              >
                                {curr.currentHoldings > 0
                                  ? formatCurrency(unrealizedPnL)
                                  : "-"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    
                    {/* 日本円行 */}
                    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors bg-white/5">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-white">JPY</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <ArrowDownCircle className="w-4 h-4 text-green-400" />
                          <span className="text-gray-300">
                            {formatCurrency(data.totalDeposit)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-medium">
                          {formatCurrency(calculateCurrentCash())}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">-</span>
                      </td>
                    </tr>
                    
                    {/* 合計行 */}
                    <tr className="border-t-2 border-white/20 bg-gradient-to-r from-purple-600/10 to-blue-600/10">
                      <td className="px-6 py-4">
                        <span className="font-bold text-white text-lg">合計</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-400">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-400">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white font-bold">
                            総資産額
                          </p>
                          <p className="text-xl font-bold text-purple-400">
                            {formatCurrency(calculateCurrentCash() + calculateTotalAssets())}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-400">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-400">-</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-gray-400 text-xs">実現損益</p>
                          <p className={`font-bold ${calculateTotalPnL() >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(calculateTotalPnL())}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-gray-400 text-xs">含み損益</p>
                          <p className={`font-bold ${calculateTotalUnrealizedPnL() >= 0 ? "text-blue-400" : "text-orange-400"}`}>
                            {formatCurrency(calculateTotalUnrealizedPnL())}
                          </p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ファイル情報 */}
            <div className="text-center text-gray-400 text-sm space-y-2">
              <p>アップロードファイル: {fileName}</p>
              {data.dateRange.start && data.dateRange.end && (
                <p>算出期間: {data.dateRange.start.toLocaleDateString('ja-JP')} 〜 {data.dateRange.end.toLocaleDateString('ja-JP')}</p>
              )}
              <p className="text-xs">
                ※現在価格は手動で編集してください（価格をクリック）
              </p>
              <button
                onClick={() => {
                  setData(null);
                  setFileName("");
                  setCurrentPrices({});
                }}
                className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                新しいファイルをアップロード
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CryptoTaxCalculator;
