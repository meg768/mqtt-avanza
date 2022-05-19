#!/usr/bin/env node
const Avanza = require('avanza');

require('dotenv').config();

async function run() {
	
	try {
		const avanza = new Avanza();
	
		await avanza.authenticate({
			username: process.env.USERNAME,
			password: process.env.PASSWORD,
			totpSecret: process.env.SECRET
		});
	
		let positions = await avanza.getOverview();
		console.log(positions);
	
	}
	catch(error) {
		console.log(error);
	}
	  
}

run();
