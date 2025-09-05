export interface Transaction {
  date: Date;
  type: string;
  amount: number;
  price: number;
  fee: number;
  jpyAmount: number;
}

export interface PurchaseLot {
  date: Date;
  amount: number;
  unitPrice: number;
  totalCost: number;
}

export interface CurrencyData {
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

export interface ProcessedData {
  currencyData: Record<string, CurrencyData>;
  totalDeposit: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}