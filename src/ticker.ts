import fetch from 'node-fetch';
import { TickerOptions, QuoteResponse, TickerSymbols } from './ticker-options';

interface TableRow {
	[column: string]: string | number;
}

export class Ticker {
	private static defaults: TickerOptions = {
		stocks: {},
		frequency: 5
	};
	private static apiEndpoint = 'https://query1.finance.yahoo.com/v7/finance/quote?lang=en-US&region=US&corsDomain=finance.yahoo.com';
	private static fields = [
		'symbol',
		'marketState',
		'regularMarketPrice',
		'regularMarketChange',
		'regularMarketChangePercent',
		'preMarketPrice',
		'preMarketChange',
		'preMarketChangePercent',
		'postMarketPrice',
		'postMarketChange',
		'postMarketChangePercent'
	];

	private static colors = {
		Reset: "\x1b[0m",
		Bright: "\x1b[1m",
		Red: "\x1b[31m",
		Green: "\x1b[32m"
	}

	public readonly options: TickerOptions;

	private running = false;
	private previousTable: TableRow[] | null = null;

	constructor(options: TickerOptions) {
		this.options = { ...Ticker.defaults, ...options }
	}

	public async start(): Promise<void> {
		if (typeof (this.options.frequency) === 'number' && this.options.frequency > 0) {

			this.previousTable = await this.update(this.previousTable);

			setInterval(async () => {
				this.previousTable = await this.update(this.previousTable);
			}, this.options.frequency * 1000);
		}
	}

	private async update(previousTable: TableRow[] | null): Promise<TableRow[] | null> {
		if (this.running)
			return null;

		this.running = true;

		const results = await this.pullStocks(this.options.stocks);

		if (results.error)
			throw new Error(results.error);

		const columns: { [column: string]: { length: number, color?: string } } = {
			'Symbol': { length: 0, color: Ticker.colors.Bright },
			'Price': { length: 0, color: Ticker.colors.Bright },
			'Change': { length: 0 },
			'Change %': { length: 0 },
			'Total Change': { length: 0 },
			'Total %': { length: 0 },
			'Current Value': { length: 0, color: Ticker.colors.Bright },
			' ': { length: 0 }
		}

		Object.keys(columns).forEach(column => {
			columns[column].length = column.length;
		});

		const table = results.result.map((quote, index) => {
			let nonRegularMarket = '';

			let price = quote.regularMarketPrice;
			let change = quote.regularMarketChange;
			let changePercent = quote.regularMarketChangePercent;

			switch (quote.marketState) {
				case 'PRE':
					nonRegularMarket = '<'
					price = quote.preMarketPrice;
					change = quote.preMarketChange;
					changePercent = quote.preMarketChangePercent;
					break;
				case 'POST':
					nonRegularMarket = '>'
					price = quote.postMarketPrice;
					change = quote.postMarketChange;
					changePercent = quote.postMarketChangePercent;
					break;
				default:
					break;
			}

			let oldValue = 0;
			let newValue = 0;

			this.options.stocks[quote.symbol].forEach(holding => {
				oldValue += holding.amount * holding.price;
				newValue += holding.amount * price;
			});

			const totalChange = newValue - oldValue;

			const row: TableRow = {
				'Symbol': quote.symbol,
				'Price': price.toFixed(2),
				'Change': change,
				'Change %': changePercent,
				'Total Change': totalChange,
				'Total %': ((totalChange / oldValue) * 100),
				'Current Value': newValue.toFixed(2),
				' ': nonRegularMarket
			};

			Object.keys(row).forEach(column => {
				let value = row[column];

				if (value == null && previousTable != null && previousTable.length > index) {
					value = previousTable[index][column];
					row[column] = value;
				}

				if (typeof (value) === 'string')
					columns[column].length = Math.max(columns[column].length, value.length);
				else
					columns[column].length = Math.max(columns[column].length, value.toFixed(2).length);
			});

			return row;
		});

		console.clear();

		console.log(Ticker.colors.Bright + Object.keys(columns).map(column => column.padEnd(columns[column].length)).join('  ') + Ticker.colors.Reset);

		table.forEach(row => {
			console.log(Object.keys(columns).map(column => {
				const color = columns[column].color;
				let value = row[column];
				if (typeof (value) === 'string') {
					value = value.padStart(columns[column].length);

					if (color)
						return color + value + Ticker.colors.Reset;

					return value;
				}

				return this.colored(value, columns[column].length);
			}).join('  '));
		});

		console.log();
		console.log(new Date());
		this.running = false;

		return table;
	}

	private colored(val: number, padding: number): string {
		let color = '';

		if (val < 0)
			color = Ticker.colors.Red
		else if (val > 0)
			color = Ticker.colors.Green

		return color + val.toFixed(2).padStart(padding) + (color.length > 0 ? Ticker.colors.Reset : '');
	}

	private async pullStocks(stocks: TickerSymbols): Promise<QuoteResponse> {
		const url = `${Ticker.apiEndpoint}&fields=${Ticker.fields.join(',')}&symbols=${Object.keys(stocks).join(',')}`;

		// console.log(url);

		return fetch(url)
			.then((res) => res.json())
			.then(json => json.quoteResponse as QuoteResponse);
	}
}