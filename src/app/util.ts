/**
 * UTC時間をJSTに変換
 */
export const utcToJst = (utcDate: Date) => {
  const jstDate = new Date(utcDate.getTime());
  return jstDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
};

/**
 * 日付文字列をUnixTimeに変換
 */
export const dateToUnixTime = (dateString: string) => {
  const date = new Date(dateString);
  const unixTime = date.getTime();
  return unixTime;
};

export const COLORS = [
  "#82ca9d",
  "#8884d8",
  "#CB80AB",
  "#E6D9A2",
  "#FFBE98",
  "#F05A7E",
  "#125B9A",
  "#0B8494",
];
