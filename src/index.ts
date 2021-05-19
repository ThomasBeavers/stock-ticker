import { Ticker } from './ticker';
import { TickerStartOptions, TickerSymbols } from './ticker-options';

const options: TickerStartOptions = {
	configPath: './config.json'
};

new Ticker(options)
	.start()
	.then(() => {
	}, err => console.error(err));