#!/usr/bin/env node
require('dotenv').config();
console.log(require('avanza/dist/totp')(process.env.SECRET));