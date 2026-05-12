import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const result = await yf.options("AAPL");
const first = result.options[0];
if (first) {
  const call = first.calls[0];
  const atmIdx = first.calls.findIndex(c => c.inTheMoney === false);
  const atmCall = first.calls[Math.max(0, atmIdx - 1)];
  console.log("Spot price:", result.quote.regularMarketPrice);
  console.log("Expiration:", first.expirationDate);
  console.log("Sample call (near ATM):", JSON.stringify(atmCall, null, 2));
  console.log("Total calls:", first.calls.length);
  console.log("Total puts:", first.puts.length);
  console.log("First call keys:", Object.keys(first.calls[0] ?? {}));
}
process.exit(0);
