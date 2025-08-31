import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * USD/JPYレートを取得
 */
export async function GET(request: NextRequest) {
  try {
    const symbol = "USDJPY=X";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Failed to fetch USD/JPY rate");
    }

    const data = await res.json();
    const result = data.chart.result[0];
    const price = result.meta.regularMarketPrice || result.meta.previousClose;

    return NextResponse.json({
      result: true,
      price,
      symbol: "USD/JPY",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ result: false });
  }
}
