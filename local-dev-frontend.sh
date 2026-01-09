#!/bin/bash
npm cache clean --force && rm -rf node_modules && npm install && npm run dev
