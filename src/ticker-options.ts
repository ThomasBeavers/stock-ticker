export interface TickerOptions {
	stocks: TickerSymbols;
	frequency?: number;
}

export interface TickerSymbols {
	[symbol: string]: Position[];
}

export interface Position {
	amount: number;
	price: number;
}

export interface QuoteResponse {
	result: Quote[];
	error?: string;
}

export interface Quote {
	language: string
	region: string
	quoteType: string
	quoteSourceName: string
	triggerable: boolean,
	exchange: string
	exchangeTimezoneName: string
	exchangeTimezoneShortName: string
	gmtOffSetMilliseconds: number,
	market: string
	esgPopulated: boolean,
	marketState: string
	priceHint: number,
	sourceInterval: number,
	exchangeDataDelayedBy: number,
	tradeable: boolean,
	firstTradeDateMilliseconds: number,
	preMarketChange: number,
	preMarketChangePercent: number,
	preMarketTime: number,
	preMarketPrice: number,
	postMarketChangePercent: number,
	postMarketTime: number,
	postMarketPrice: number,
	postMarketChange: number,
	regularMarketChange: number,
	regularMarketChangePercent: number,
	regularMarketTime: number,
	regularMarketPrice: number,
	regularMarketPreviousClose: number,
	regularMarketVolume: number,
	fullExchangeName: string
	symbol: string
}