import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { CurrencyData, ProcessedData } from "@/types/crypto";

/**
 * 日本語対応PDF生成（HTML経由）
 */
export const generateJapaneseTaxReportPDF = async (
  data: ProcessedData,
  year: number,
  method: string = "移動平均法"
) => {
  // 一時的なHTML要素を作成
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "210mm"; // A4サイズ
  container.style.padding = "20mm";
  container.style.backgroundColor = "white";
  container.style.fontFamily = "'Hiragino Sans', 'Yu Gothic', sans-serif";
  
  // HTMLコンテンツを生成
  let totalRevenue = 0;
  let totalCost = 0;
  let totalIncome = 0;
  
  const tableRows: string[] = [];
  
  Object.entries(data.currencyData).forEach(([currency, currencyData]) => {
    if (currency === "JPY") return;
    
    const revenue = currencyData.totalRevenue || 0;
    const cost = currencyData.currentCost || 0;
    const income = currencyData.realizedPnL || 0;
    
    totalRevenue += revenue;
    totalCost += cost;
    totalIncome += income;
    
    tableRows.push(`
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${currency}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">¥${Math.floor(revenue).toLocaleString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">¥${Math.floor(cost).toLocaleString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">¥${Math.floor(income).toLocaleString()}</td>
      </tr>
    `);
  });
  
  container.innerHTML = `
    <div style="font-size: 14px; color: #333;">
      <h1 style="text-align: center; font-size: 24px; margin-bottom: 30px;">
        暗号資産取引計算書
      </h1>
      
      <div style="margin-bottom: 20px;">
        <p style="margin: 5px 0;"><strong>対象年度：</strong>${year}年</p>
        <p style="margin: 5px 0;"><strong>計算方法：</strong>${method}</p>
        <p style="margin: 5px 0;"><strong>作成日：</strong>${new Date().toLocaleDateString("ja-JP")}</p>
      </div>
      
      <h2 style="font-size: 18px; margin-top: 30px; margin-bottom: 15px;">
        通貨別損益計算結果
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">通貨</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">売却収入</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">必要経費</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">所得金額</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.join("")}
          <tr style="background-color: #f0f0f0; font-weight: bold;">
            <td style="padding: 8px; border: 1px solid #ddd;">合計</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">¥${Math.floor(totalRevenue).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">¥${Math.floor(totalCost).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">¥${Math.floor(totalIncome).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 10px;">確定申告用情報</h3>
        <p style="font-size: 20px; font-weight: bold; color: #2563eb;">
          雑所得金額：¥${Math.floor(totalIncome).toLocaleString()}
        </p>
      </div>
      
      <div style="margin-top: 30px; padding: 10px; background-color: #fff3cd; border-radius: 5px;">
        <p style="font-size: 12px; color: #856404; margin: 0;">
          <strong>注意事項：</strong><br>
          ※ この計算書は参考資料です。実際の確定申告には税理士にご相談ください。<br>
          ※ 計算方法により税額が異なる場合があります。<br>
          ※ 手数料やその他の経費は別途計上が必要な場合があります。
        </p>
      </div>
    </div>
  `;
  
  // DOMに追加
  document.body.appendChild(container);
  
  try {
    // HTML要素を画像化
    const canvas = await html2canvas(container, {
      scale: 2, // 高解像度化
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff"
    });
    
    // PDFを生成
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    
    const imgWidth = 210; // A4幅
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    
    // PDFを保存
    pdf.save(`暗号資産計算書_${year}年.pdf`);
    
  } finally {
    // 一時要素を削除
    document.body.removeChild(container);
  }
};