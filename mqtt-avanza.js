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

	async loop() {
		const round = require('yow/round');

		let totalOverview = await this.avanza.getOverview();
		let accounts = totalOverview.accounts;

		if (this.argv.debug) {
			this.mqtt.publish(`${this.argv.topic}`, JSON.stringify(totalOverview), {retain:false});
		}


		for (let account of accounts) {
			let overview = await this.avanza.getAccountOverview(account.accountId);

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
				performance: round(overview.performanceSinceOneWeekPercent, 1),
				profit:round(overview.performanceSinceOneWeek)
			}
			summary['1m'] = {
				performance: round(overview.performanceSinceOneMonthPercent, 1),
				profit:round(overview.performanceSinceOneMonth)
			}
			summary['3m'] = {
				performance: round(overview.performanceSinceThreeMonthsPercent, 1),
				profit:round(overview.performanceSinceThreeMonths)
			}
			summary['6m'] = {
				performance: round(overview.performanceSinceSixMonthsPercent, 1),
				profit:round(overview.performanceSinceSixMonths)
			}
			summary['1y'] = {
				performance: round(overview.performanceSinceOneYearPercent, 1),
				profit:round(overview.performanceSinceOneYear)
			}
			summary['3y'] = {
				performance: round(overview.performanceSinceThreeYearsPercent, 1),
				profit:round(overview.performanceSinceThreeYears)
			}
			
			if (this.cache[summary.name] == undefined || this.cache[summary.name] != JSON.stringify(summary)) {
				this.cache[summary.name] = JSON.stringify(summary);
				this.mqtt.publish(`${this.argv.topic}/${summary.name}`, JSON.stringify(summary), {retain:true});
				if (this.argv.debug) {
					this.mqtt.publish(`${this.argv.topic}/${summary.name}/debug/account`, JSON.stringify(account), {retain:false});
					this.mqtt.publish(`${this.argv.topic}/${summary.name}/debug/overview`, JSON.stringify(overview), {retain:false});	
				}
			}
		}

		setTimeout(this.loop.bind(this), this.argv.interval * 1000 * 60);


	}
	async run() {
		await this.connect();
		await this.login();

		await this.loop();

	}
}

const app = new App();
app.run();
