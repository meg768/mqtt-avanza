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
		yargs.option('topic', {describe:'MQTT topic', type:'number', default:this.config.topic || "Avanza"});

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

		let positions = await this.avanza.getOverview();
		let accounts = positions.accounts;

		for (let account of accounts) {
			let summary = {};

			summary.name = account.name;
			summary.type = account.accountType;
			summary.capital = round(account.ownCapital, -1);

			summary.total = {};
			summary.total.performance = round(account.totalProfitPercent, 1);
			summary.total.profit = round(account.totalProfit, -1);

			summary.ytd = {};
			summary.ytd.performance = round(account.performancePercent, 1);
			summary.ytd.profit = round(account.performance, -1);
		
			if (this.cache[summary.name] == undefined || this.cache[summary.name] != JSON.stringify(summary)) {
				this.cache[summary.name] = JSON.stringify(summary);
				this.mqtt.publish(`${this.argv.topic}/${summary.name}`, JSON.stringify(summary), {retain:true});
				this.debug(account);
				this.debug(summary);
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
