export interface TickerStartOptions {
  configPath: string;
  frequency?: number;
  limitHours?: boolean;
}

export interface TickerOptions extends TickerStartOptions {
  stocks: TickerSymbols;
}

export interface TickerSymbols {
  [symbol: string]: TickerSymbol;
}

export interface TickerSymbol {
  alerts?: number[];
  positions?: Position[];
}
export interface Position {
  amount: number;
  price: number;
}

// export interface QuoteResponse {
//   error?: string;
//   result: Quote[];
// }

// export function isQuoteResponse(obj: any): obj is QuoteResponse {
//   if (
//     typeof obj !== "object" ||
//     obj == null ||
//     !("result" in obj) ||
//     !Array.isArray(obj.result)
//   ) {
//     return false;
//   }

//   for (const item of obj.result) {
//     if (!isQuote(item)) {
//       return false;
//     }
//   }

//   return true;
// }

// export interface Quote {
//   esgPopulated: boolean;
//   exchange: string;
//   exchangeDataDelayedBy: number;
//   exchangeTimezoneName: string;
//   exchangeTimezoneShortName: string;
//   firstTradeDateMilliseconds: number;
//   fullExchangeName: string;
//   gmtOffSetMilliseconds: number;
//   language: string;
//   market: string;
//   marketState: string;
//   postMarketChange: number;
//   postMarketChangePercent: number;
//   postMarketPrice: number;
//   postMarketTime: number;
//   preMarketChange: number;
//   preMarketChangePercent: number;
//   preMarketPrice: number;
//   preMarketTime: number;
//   priceHint: number;
//   quoteSourceName: string;
//   quoteType: string;
//   region: string;
//   regularMarketChange: number;
//   regularMarketChangePercent: number;
//   regularMarketPreviousClose: number;
//   regularMarketPrice: number;
//   regularMarketTime: number;
//   regularMarketVolume: number;
//   sourceInterval: number;
//   symbol: string;
//   tradeable: boolean;
//   triggerable: boolean;
// }

// export function isQuote(obj: any): obj is Quote {
//   return (
//     typeof obj === "object" &&
//     obj != null &&
//     "symbol" in obj &&
//     "regularMarketPrice" in obj &&
//     "regularMarketChange" in obj &&
//     "regularMarketChangePercent" in obj &&
//     "regularMarketVolume" in obj
//   );
// }
