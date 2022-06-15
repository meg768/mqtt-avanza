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

	async getPositions() {
		let positions = await this.avanza.getPositions();

	
		return positions;
	}


	async getOverview() {

		let overview = await this.avanza.getOverview();

		
		for (let account of overview.accounts) {

			account.overview = await this.avanza.getAccountOverview(account.accountId);
		}

		return overview;


	}

	async getWatchlists() {
		let watchLists = await this.avanza.getWatchlists();
		return watchLists;

	}

	async run() {
		try {
			await this.connect();
			await this.login();
	
			let json = {};
			json.overview = await this.getOverview();
			json.positions = await this.getPositions();
			json.watchLists = await this.getWatchlists();

			this.mqtt.publish(`debug/avanza`, JSON.stringify(json), {retain:true});


//			process.exit(-1);
		
		}
		catch(error) {
			this.log(error.stack);
			process.exit(-1);

		}

	}
}

const app = new App();
app.run();
