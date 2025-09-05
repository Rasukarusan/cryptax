# CLAUDE.md

このファイルは、このリポジトリでClaude Code (claude.ai/code)が作業する際のガイドラインを提供します。

## プロジェクト概要

Next.jsで構築された暗号資産税計算ツールのWebアプリケーションです。bitFlyerなどの取引所からのCSV取引レポートを処理し、様々な会計方法で損益を計算します。

## 開発コマンド

### 主要な開発コマンド
```bash
# Turbopackで開発サーバーを起動
npm run dev

# 本番用ビルド
npm run build

# 本番サーバーを起動
npm start

# Biomeでリント実行
npm run lint

# Biomeでコードフォーマット
npm run format
```

### コード品質管理コマンド
```bash
# コードチェック（フォーマット、リント、インポート整理）
npx biome check

# 自動修正
npx biome check --write

# 特定ファイルのチェック
npx biome check src/components/CryptoTaxCalculator.tsx

# 特定ファイルのフォーマット
npx biome format --write src/**/*.tsx
```

## アーキテクチャ

### 技術スタック
- **フレームワーク**: Next.js 15.5.2 + React 19
- **言語**: TypeScript（strict mode）
- **スタイリング**: Tailwind CSS v4
- **リント/フォーマット**: Biome 2.2.0
- **ビルド**: Turbopack
- **CSV解析**: papaparse

### プロジェクト構造
- `/src/app/` - Next.js App RouterのページとAPIルート
  - `page.tsx` - CryptoTaxCalculatorをレンダリングするエントリポイント
  - `/api/binance/` - Binance価格APIプロキシ
  - `/api/yahoo-finance/` - USD/JPY為替レートAPI
- `/src/components/` - Reactコンポーネント
  - `CryptoTaxCalculator.tsx` - メイン計算機コンポーネント（800行以上）
- `/public/` - 静的アセット

### 主要コンポーネント

#### CryptoTaxCalculatorコンポーネント
メインコンポーネントの機能:
- bitFlyer取引データのCSVアップロードと解析
- 取引処理（買付、売却、受取、送付）
- 3つの計算方法: 移動平均法、総平均法、FIFO
- BinanceとYahoo Finance APIからのリアルタイム価格取得
- ローカルストレージによるデータ永続化
- 損益計算と可視化

#### APIルート
- `/api/binance/route.ts` - Binanceから現在の暗号資産価格を取得
- `/api/yahoo-finance/usd/route.ts` - 価格変換用のUSD/JPY為替レートを取得

### データフロー
1. ユーザーがbitFlyerのCSVをアップロード
2. papaparseでクライアントサイドでCSVを解析
3. 取引を処理し通貨別に分類
4. 取得価額計算のため購入ロットを追跡
5. 含み損益のためAPIで現在価格を取得
6. 結果を表示し、localStorageへの保存オプション提供

## 設定

### Biome設定
プロジェクトはBiomeを使用:
- 2スペースインデント
- Next.jsとReactの推奨ルール
- 自動インポート整理有効

### TypeScript設定
- ターゲット: ES2017
- Strictモード有効
- パスエイリアス: `@/*` → `./src/*`
- Next.js用JSX保持

### Next.js設定
- React Strictモード無効（`reactStrictMode: false`）
- 開発・ビルドでTurbopack有効

## 開発ノート

### 状態管理
React useStateですべての状態を管理、主な状態構造:
- `ProcessedData` - 通貨データ、総入金額、日付範囲を含む
- `CurrencyData` - 通貨別の取引履歴と計算結果
- `PurchaseLot` - 取得価額追跡用の個別購入記録

### 期待されるCSVフォーマット
bitFlyerのCSVフォーマット:
- 取引日時
- 通貨1
- 通貨1数量
- 通貨2
- 通貨2数量
- 手数料(通貨2)
- 取引種別

### ローカルストレージ
- データ保存キー: `crypto-tax-calculator-data`
- タイムスタンプは別途保存（データ鮮度確認用）
- ページ読み込み時に前回データ使用を促すプロンプト表示