import { Ticker } from './ticker';
import { TickerOptions, TickerSymbols } from './ticker-options';
import config from './config.json';

const options: TickerOptions = {
	stocks: config
};

new Ticker(options)
	.start()
	.then(() => {
	}, err => console.error(err));