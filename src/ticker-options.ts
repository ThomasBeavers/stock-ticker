export interface TickerOptions {
	frequency?: number;
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

export interface QuoteResponse {
	error?: string;
	result: Quote[];
}

export interface Quote {
	esgPopulated: boolean,
	exchange: string
	exchangeDataDelayedBy: number,
	exchangeTimezoneName: string
	exchangeTimezoneShortName: string
	firstTradeDateMilliseconds: number,
	fullExchangeName: string
	gmtOffSetMilliseconds: number,
	language: string
	market: string
	marketState: string
	postMarketChange: number,
	postMarketChangePercent: number,
	postMarketPrice: number,
	postMarketTime: number,
	preMarketChange: number,
	preMarketChangePercent: number,
	preMarketPrice: number,
	preMarketTime: number,
	priceHint: number,
	quoteSourceName: string
	quoteType: string
	region: string
	regularMarketChange: number,
	regularMarketChangePercent: number,
	regularMarketPreviousClose: number,
	regularMarketPrice: number,
	regularMarketTime: number,
	regularMarketVolume: number,
	sourceInterval: number,
	symbol: string
	tradeable: boolean,
	triggerable: boolean,
}