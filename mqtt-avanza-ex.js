#!/usr/bin/env node
const Avanza = require('avanza');
const Mqtt = require('mqtt');

class App {

	constructor() {

		this.config = require('yow/config')();

		const yargs = require('yargs');
		yargs.usage('Usage: $0 [options]')
		yargs.option('help',     {alias:'h', describe:'Displays this information'});
		yargs.option('debug',    {describe:'Debug mode', type:'boolean', default:this.config.debug || false});
		yargs.option('interval', {describe:'Poll interval in minutes', type:'number', default:this.config.interval || 1});
		yargs.option('topic',    {describe:'MQTT topic', type:'number', default:this.config.topic || "Avanza"});

		yargs.help();
		yargs.wrap(null);

		yargs.check(function(argv) {
			return true;
		});

		this.argv = yargs.argv;
		this.log = console.log;
		this.debug = this.argv.debug ? this.log : () => {};
		this.cache = {};
	
	}

	async connect() {
		return new Promise((resolve, reject) => {
			this.mqtt = Mqtt.connect(this.config.mqtt.host, {username:this.config.mqtt.username, password:this.config.mqtt.password, port:this.config.mqtt.port});
				
			this.mqtt.on('connect', () => {
				this.debug(`Connected to host ${this.config.mqtt.host}:${this.config.mqtt.port}.`);
				resolve();
			});		
	
		});
	}

	async login() {
		this.avanza = new Avanza();

		await this.avanza.authenticate({
			username: this.config.avanza.username,
			password: this.config.avanza.password,
			totpSecret: this.config.avanza.secret
		});
	}

	async publishPositions() {
		const round = require('yow/round');
		let positions = await this.avanza.getPositions();

		for (let instrument of positions.instrumentPositions) {
			for (let position of instrument.positions) {

				if (this.argv.debug) {
					this.mqtt.publish(`debug/${position.accountName}/positions/${position.name}`, JSON.stringify(position), {retain:false});
				}
		
				let summary = {};
				summary.name = position.name;
				summary.change = round(position.changePercent, 2);
				summary.value = round(position.value, 0);
				summary.profit = round(position.profit, 0);
				summary.performance = round(position.profitPercent, 2);
				this.mqtt.publish(`${this.argv.topic}/${position.accountName}/${position.name}`, JSON.stringify(summary), {retain:false});

			}
		}

	}


	async publishAccounts() {
		const round = require('yow/round');

		let overview = await this.avanza.getOverview();

		if (this.argv.debug) {
			this.mqtt.publish(`debug/overview`, JSON.stringify(overview), {retain:false});
		}

		for (let account of overview.accounts) {
			let accountOverview = await this.avanza.getAccountOverview(account.accountId);

			if (this.argv.debug) {
				this.mqtt.publish(`debug/${account.name}/account`, JSON.stringify(account), {retain:false});
				this.mqtt.publish(`debug/${account.name}/account/overview`, JSON.stringify(accountOverview), {retain:false});	
			}
	
			let summary = {};
			summary.name = account.name;
			summary.type = account.accountType;
			summary.capital = round(account.ownCapital, -1);

			summary.total = {};
			summary.total.performance = round(account.totalProfitPercent, 1);
			summary.total.profit = round(account.totalProfit, -1);

			summary['ytd'] = {
				performance:round(account.performancePercent, 1),
				profit:round(account.performance, -1)
			};
			summary['1w'] = {
				performance: round(accountOverview.performanceSinceOneWeekPercent, 1),
				profit:round(accountOverview.performanceSinceOneWeek)
			}
			summary['1m'] = {
				performance: round(accountOverview.performanceSinceOneMonthPercent, 1),
				profit:round(accountOverview.performanceSinceOneMonth)
			}
			summary['3m'] = {
				performance: round(accountOverview.performanceSinceThreeMonthsPercent, 1),
				profit:round(accountOverview.performanceSinceThreeMonths)
			}
			summary['6m'] = {
				performance: round(accountOverview.performanceSinceSixMonthsPercent, 1),
				profit:round(accountOverview.performanceSinceSixMonths)
			}
			summary['1y'] = {
				performance: round(accountOverview.performanceSinceOneYearPercent, 1),
				profit:round(accountOverview.performanceSinceOneYear)
			}
			summary['3y'] = {
				performance: round(accountOverview.performanceSinceThreeYearsPercent, 1),
				profit:round(accountOverview.performanceSinceThreeYears)
			}
			
			if (this.cache[summary.name] == undefined || this.cache[summary.name] != JSON.stringify(summary)) {
				this.cache[summary.name] = JSON.stringify(summary);
				this.mqtt.publish(`${this.argv.topic}/${summary.name}`, JSON.stringify({date:new Date(), ...summary}), {retain:true});
			}
		}


	}

	async loop() {
		await this.publishAccounts();
		await this.publishPositions();

		setTimeout(this.loop.bind(this), this.argv.interval * 1000 * 60);
	}

	async run() {
		try {
			await this.connect();
			await this.login();
	
			await this.loop();
	
		}
		catch(error) {
			this.log(error.stack);
			process.exit(-1);

		}

	}
}

const app = new App();
app.run();
