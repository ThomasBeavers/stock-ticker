import { Ticker } from './ticker';
import { TickerOptions } from './ticker-options';

const options: TickerOptions = {
	stocks: {
		'GME': {
			alerts: [
				420
			],
			positions: [
				{
					amount: 330,
					price: 95
				},
				{
					amount: 54,
					price: 37
				},
				{
					amount: 16,
					price: 34.98
				}
			]
		},
		'AMC': {
			alerts: [
				15.6
			],
			positions: [
				{
					amount: 1462,
					price: 15.57
				}
			]
		},
		'PLTR': {
			positions: [
				{
					amount: 17,
					price: 27.72
				},
				{
					amount: 2,
					price: 28.55
				}
			]
		},
		'ETH-USD': {
			positions: [
				{
					amount: 5,
					price: 1135.64
				}
			]
		}
	}
};

new Ticker(options)
	.start()
	.then(() => {
	}, err => console.error(err));