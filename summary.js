#!/usr/bin/env node
const Avanza = require('avanza');
const AvanzaSummary = require('./avanza-summary.js');
const Mqtt = require('mqtt');



class App {

	constructor() {

		this.config = require('yow/config')();

		const yargs = require('yargs');
		yargs.usage('Usage: $0 [options]')
		yargs.option('help',     {alias:'h', describe:'Displays this information'});
		yargs.option('debug',    {describe:'Debug mode', type:'boolean', default:this.config.debug || false});

		yargs.help();
		yargs.wrap(null);

		yargs.check(function(argv) {
			return true;
		});

		this.argv = yargs.argv;
		this.log = console.log;
		this.debug = this.argv.debug ? this.log : () => {};
	
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


	async run() {
		try {
			let overview = new AvanzaSummary({username:this.config.avanza.username, password:this.config.avanza.password, totpSecret:this.config.avanza.secret});
	
			await overview.authenticate();
			await this.connect();
			

			let json = await overview.fetchWatch();
			//this.mqtt.publish(`summary`, JSON.stringify(json), {retain:false});
			console.log(JSON.stringify(json, null, '  '));
	
		}
		catch(error) {
			console.log(error);
			this.log(error.stack);
			process.exit(-1);

		}

	}
}

const app = new App();
app.run();
