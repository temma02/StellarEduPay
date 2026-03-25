#!/usr/bin/env node
'use strict';

/**
 * Generates a new Stellar keypair for use as the school wallet.
 *
 * Usage:
 *   node scripts/create-school-wallet.js
 *
 * Copy the PUBLIC KEY into your backend/.env as SCHOOL_WALLET_ADDRESS.
 * Keep the SECRET KEY offline — the backend never needs it.
 *
 * To fund the wallet on testnet, visit:
 *   https://laboratory.stellar.org/#account-creator?network=test
 * or run:
 *   curl "https://friendbot.stellar.org?addr=<PUBLIC_KEY>"
 */

const { Keypair } = require('../backend/node_modules/@stellar/stellar-sdk');

const pair = Keypair.random();

console.log('\n✅ New Stellar keypair generated\n');
console.log('PUBLIC KEY  (SCHOOL_WALLET_ADDRESS):', pair.publicKey());
console.log('SECRET KEY  (keep offline, never commit):', pair.secret());
console.log('\nAdd to backend/.env:');
console.log(`  SCHOOL_WALLET_ADDRESS=${pair.publicKey()}`);
console.log('\nFund on testnet:');
console.log(`  curl "https://friendbot.stellar.org?addr=${pair.publicKey()}"\n`);
