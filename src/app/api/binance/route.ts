import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ENDPOINT = "https://api.binance.com/api/v3";

// 簡易版：特定通貨の現在価格を取得
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbols = searchParams.get("symbols")?.split(",") || [];

    if (!symbols.length) {
      return NextResponse.json({ result: false, data: {} });
    }

    const prices: Record<string, number> = {};

    // 各通貨ペアの現在価格を取得
    for (const symbol of symbols) {
      try {
        const res = await fetch(
          `${ENDPOINT}/ticker/price?symbol=${symbol}USDT`,
        );
        if (res.ok) {
          const data = await res.json();
          prices[symbol] = parseFloat(data.price);
        }
      } catch (e) {
        console.error(`Failed to fetch price for ${symbol}:`, e);
      }
    }

    return NextResponse.json({ result: true, prices });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ result: false });
  }
}
