#!/usr/bin/env node

const path = require('node:path');
const { spawn } = require('node:child_process');

const target = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : '';
const electronBinary = require('electron');
const appRoot = path.resolve(__dirname, '..');
const child = spawn(electronBinary, [appRoot, ...(target ? ['--launch-folder', target] : [])], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: false
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
