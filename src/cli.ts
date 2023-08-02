#!/usr/bin/env node

import {Engine} from './engine/Engine';
import { RuleError } from './errors';

let filePath = process.argv[2];

if (!filePath) {
  console.error('Path to the rules file is not provided.');
  console.error('Usage:')
  console.error('  rules <path>');
  process.exit(1); 
}

/**
 * Run engine file
 */
const run = async () => {
  const engine = new Engine(console.log);
  await engine.init(filePath, true);
} 

run().catch((err) => {
  if (err instanceof RuleError) {
    console.error(`Rule "${err.rule}" error occurred on step "${err.step}" with code "${err.code}" and message "${err.message}"`);
  } else {
    console.error(err);
  }
  
  process.exit(1);
});