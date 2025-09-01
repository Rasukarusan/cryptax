import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ENDPOINT = "https://api.binance.com/api/v3";

// 簡易版：特定通貨の現在価格を取得
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbolsParam = searchParams.get("symbols");
    
    console.log("Binance API called with symbols:", symbolsParam);
    
    if (!symbolsParam) {
      return NextResponse.json({ 
        result: false, 
        error: "No symbols provided",
        prices: {} 
      });
    }
    
    const symbols = symbolsParam.split(",").filter(s => s.trim());
    
    if (!symbols.length) {
      return NextResponse.json({ 
        result: false, 
        error: "No valid symbols",
        prices: {} 
      });
    }

    const prices: Record<string, number> = {};
    const errors: string[] = [];

    // 各通貨ペアの現在価格を取得
    for (const symbol of symbols) {
      try {
        const url = `${ENDPOINT}/ticker/price?symbol=${symbol.trim()}USDT`;
        console.log(`Fetching price for ${symbol} from: ${url}`);
        
        const res = await fetch(url);
        
        if (res.ok) {
          const data = await res.json();
          if (data.price) {
            prices[symbol] = parseFloat(data.price);
            console.log(`${symbol}: ${data.price}`);
          }
        } else {
          const errorText = await res.text();
          console.error(`Failed to fetch ${symbol}: ${res.status} - ${errorText}`);
          errors.push(`${symbol}: ${res.status}`);
        }
      } catch (e) {
        console.error(`Error fetching price for ${symbol}:`, e);
        errors.push(`${symbol}: ${e}`);
      }
    }

    return NextResponse.json({ 
      result: true, 
      prices,
      debug: {
        requestedSymbols: symbols,
        successCount: Object.keys(prices).length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (e) {
    console.error("Binance API error:", e);
    return NextResponse.json({ 
      result: false,
      error: String(e),
      prices: {}
    });
  }
}
