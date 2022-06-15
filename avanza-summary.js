#!/usr/bin/env node
const Avanza = require('avanza');

module.exports = class AvanzaSummary {

	constructor(options) {
		let {username, password, secret, totpSecret} = options;

		this.avanza = new Avanza();
		this.username = username;
		this.password = password;
		this.secret = secret || totpSecret;
	}

	async authenticate() {
		let options = {username: this.username, password: this.password, totpSecret: this.secret};
		await this.avanza.authenticate(options);
	}

	async fetch() {
		let result = {};
		result.accounts = await this.fetchAccounts();
		result.watch = await this.fetchWatch();
		

		return result;
	}

	async fetchWatch() {
		let result = {};
		let watchLists =  await this.avanza.getWatchlists();

		
		for (let watchList of watchLists) {
			let orderbooks = await this.avanza.getOrderbooks(watchList.orderbooks);

			for (let orderbook of orderbooks) {

				let item = {};
				let instrument = await this.avanza.getInstrument(orderbook.instrumentType, orderbook.id);
				console.log(instrument);

				item.date = orderbook.updated == undefined ? null : orderbook.updated;
				item.name = orderbook.name;
				item.ticker = instrument.tickerSymbol;
				item.type = orderbook.instrumentType.toLowerCase();
				item.id = instrument.id;

				switch(orderbook.instrumentType.toLowerCase()) {
					case 'fund': {
						item.change = instrument.changeSinceOneDay == undefined ? null : instrument.changeSinceOneDay;
						break;
					}
					case 'index': {
						item.change = instrument.changePercent || null;
						break;
					}
					case 'stock': {
						item.change = orderbook.changePercent == undefined ? null : orderbook.changePercent;
						break;
					}
				}


				if (result[watchList.name] == undefined)
					result[watchList.name] = [];

				result[watchList.name].push(item);
			}
		}

		return result;

	}
	async fetchAccounts() {
		const round = require('yow/round');

		let accounts = [];
		let overview = await this.avanza.getOverview();
		let positions = await this.avanza.getPositions();

		for (let account of overview.accounts) {
			let accountOverview = await this.avanza.getAccountOverview(account.accountId);

			let summary = {};
			summary.name = account.name;
			summary.id = account.accountId;
			summary.type = account.accountType;
			summary.capital = round(account.ownCapital, 0);

			summary.total = {};
			summary.total.performance = round(account.totalProfitPercent, 2);
			summary.total.profit = round(account.totalProfit);

			summary['ytd'] = {
				performance:round(account.performancePercent, 2),
				profit:round(account.performance)
			};
			summary['1w'] = {
				performance: round(accountOverview.performanceSinceOneWeekPercent, 2),
				profit:round(accountOverview.performanceSinceOneWeek)
			}
			summary['1m'] = {
				performance: round(accountOverview.performanceSinceOneMonthPercent, 2),
				profit:round(accountOverview.performanceSinceOneMonth)
			}
			summary['3m'] = {
				performance: round(accountOverview.performanceSinceThreeMonthsPercent, 2),
				profit:round(accountOverview.performanceSinceThreeMonths)
			}
			summary['6m'] = {
				performance: round(accountOverview.performanceSinceSixMonthsPercent, 2),
				profit:round(accountOverview.performanceSinceSixMonths)
			}
			summary['1y'] = {
				performance: round(accountOverview.performanceSinceOneYearPercent, 2),
				profit:round(accountOverview.performanceSinceOneYear)
			}
			summary['3y'] = {
				performance: round(accountOverview.performanceSinceThreeYearsPercent, 1),
				profit:round(accountOverview.performanceSinceThreeYears)
			}

			summary.positions = [];

			accounts.push(summary);
		}


		for (let instrument of positions.instrumentPositions) {

			for (let position of instrument.positions) {

				let account = accounts.find((element) => {
					return element.id == position.accountId;
				});

				if (account != undefined) {
					let summary = {};
					summary.date = position.lastPriceUpdated;
					summary.name = position.name;
					summary.type = instrument.instrumentType;
					summary.id = position.orderbookId;
					summary.change = round(position.changePercent, 2);
					summary.value = round(position.value, 0);
					summary.profit = round(position.profit, 0);
					summary.performance = round(position.profitPercent, 2);

					/*
					summary.instrument = {};
					try {
						summary.instrument = await this.avanza.getInstrument(summary.type, summary.id);

					}
					catch(error) {
					}
					*/

					account.positions.push(summary);
	
				}

			}
		}		

		return accounts;
	}

}

