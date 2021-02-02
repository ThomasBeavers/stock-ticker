import moment from 'moment';
import fetch from 'node-fetch';
import { TickerOptions, QuoteResponse, TickerSymbols } from './ticker-options';

const growl = require('growl');

interface TableRow {
	[column: string]: string | number;
}
interface ColumnDefinition {
	color?: string;
	compact?: boolean;
	decimals?: number;
	length: number;
	postfix?: string;
	prefix?: string;
}

export class Ticker {
	private readonly alertStatus: { [symbol: string]: { [price: number]: number } } = {};

	private static apiEndpoint = 'https://query1.finance.yahoo.com/v7/finance/quote?lang=en-US&region=US&corsDomain=finance.yahoo.com';
	private static colors = {
		Reset: "\x1b[0m",
		Bright: "\x1b[1m",
		Red: "\x1b[31m",
		Green: "\x1b[32m"
	}

	private static defaults: TickerOptions = {
		stocks: {},
		frequency: 10
	};
	private static fields = [
		'symbol',
		'marketState',
		'regularMarketPrice',
		'regularMarketChange',
		'regularMarketChangePercent',
		'regularMarketVolume',
		'preMarketPrice',
		'preMarketChange',
		'preMarketChangePercent',
		'postMarketPrice',
		'postMarketChange',
		'postMarketChangePercent'
	];

	private previousTable: TableRow[] | null = null;
	private running = false;

	public readonly options: TickerOptions;

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

	private format(val: number, columnDef: ColumnDefinition, lengthCheck: boolean = false): string {
		let formatted = '';
		if (columnDef.compact) {
			formatted = Intl.NumberFormat('en', { notation: 'compact', minimumFractionDigits: columnDef.decimals ? columnDef.decimals : 2 } as any).format(val);
		} else {
			formatted = (val || '').toLocaleString('en-US', { minimumFractionDigits: columnDef.decimals ? columnDef.decimals : 2 });
		}

		formatted = (columnDef.prefix
			+ formatted
			+ columnDef.postfix)
			.padStart(lengthCheck ? 0 : columnDef.length);

		if (lengthCheck)
			return formatted;

		let color = '';

		if (val < 0)
			color = Ticker.colors.Red
		else if (val > 0)
			color = Ticker.colors.Green

		return color + formatted + (color.length > 0 ? Ticker.colors.Reset : '');
	}

	private async pullStocks(stocks: TickerSymbols): Promise<QuoteResponse> {
		const url = `${Ticker.apiEndpoint}&fields=${Ticker.fields.join(',')}&symbols=${Object.keys(stocks).join(',')}`;

		// console.log(url);

		return fetch(url)
			.then((res) => res.json())
			.then(json => json.quoteResponse as QuoteResponse);
	}

	private async update(previousTable: TableRow[] | null): Promise<TableRow[] | null> {
		if (this.running)
			return null;

		this.running = true;

		const results = await this.pullStocks(this.options.stocks);

		if (results.error)
			throw new Error(results.error);

		const columns: { [column: string]: ColumnDefinition } = {
			'Symbol': { length: 0, color: Ticker.colors.Bright },
			'Price': { length: 0, color: Ticker.colors.Bright },
			'Change': { length: 0, prefix: '$' },
			'Change %': { length: 0, postfix: '%' },
			'Volume': { length: 0, color: Ticker.colors.Bright, compact: true },
			'Total Change': { length: 0, prefix: '$' },
			'Total %': { length: 0, postfix: '%' },
			'Current Value': { length: 0, color: Ticker.colors.Bright, prefix: '$' },
			' ': { length: 0 }
		}

		Object.keys(columns).forEach(column => {
			columns[column].length = column.length;

			if (!columns[column].prefix) {
				columns[column].prefix = '';
			}

			if (!columns[column].postfix) {
				columns[column].postfix = '';
			}
		});

		const table = results.result.map((quote, index) => {
			let nonRegularMarket = '';

			let price = quote.regularMarketPrice;
			let change = quote.regularMarketChange;
			let changePercent = quote.regularMarketChangePercent;
			let volume = quote.regularMarketVolume;

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

			const symbolConfig = this.options.stocks[quote.symbol];
			if (symbolConfig.alerts) {
				if (!this.alertStatus[quote.symbol]) {
					this.alertStatus[quote.symbol] = {};
				}

				symbolConfig.alerts.forEach(alertPrice => {
					let alertCheck = price - alertPrice;

					if (alertCheck > 0)
						alertCheck = 1;
					else if (alertCheck < 0)
						alertCheck = -1;

					if (this.alertStatus[quote.symbol][alertPrice] != null && this.alertStatus[quote.symbol][alertPrice] !== alertCheck) {
						if (alertCheck > 0)
							growl(`${quote.symbol} has gone above ${alertPrice}: ${price}`);
						else if (alertCheck < 0)
							growl(`${quote.symbol} has gone below ${alertPrice}: ${price}`);
						else
							growl(`${quote.symbol} has reached ${alertPrice}: ${price}`);
					}

					this.alertStatus[quote.symbol][alertPrice] = alertCheck;
				});
			}

			let oldValue = 0;
			let newValue = 0;

			symbolConfig.positions.forEach(holding => {
				oldValue += holding.amount * holding.price;
				newValue += holding.amount * price;
			});

			const totalChange = newValue - oldValue;

			const row: TableRow = {
				'Symbol': quote.symbol,
				'Price': this.format(price, columns['Price'], true),
				'Change': change,
				'Change %': changePercent,
				'Volume': this.format(volume, columns['Volume'], true),
				'Total Change': totalChange,
				'Total %': ((totalChange / oldValue) * 100),
				'Current Value': this.format(newValue, columns['Price'], true),
				' ': nonRegularMarket
			};

			Object.keys(row).forEach(column => {
				let value = row[column];

				if (value == null && previousTable != null && previousTable.length > index) {
					value = previousTable[index][column];
					row[column] = value;
				}

				const length = (typeof (value) === 'string')
					? value.length
					: this.format(value, columns[column], true).length;

				columns[column].length = Math.max(columns[column].length, length);
			});

			return row;
		});

		console.clear();

		console.log(Ticker.colors.Bright + Object.keys(columns)
			.map(column => column.padStart(columns[column].length))
			.join('  ') + Ticker.colors.Reset);

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

				return this.format(value, columns[column]);
			}).join('  '));
		});

		console.log();
		console.log(moment().format('L LTS'));
		this.running = false;

		return table;
	}
}