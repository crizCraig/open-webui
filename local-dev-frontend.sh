#!/bin/bash
# This project requires Node >=18.13.0 <=22.x.x. Pin to an nvm-managed v22 so it
# works regardless of the shell's default node (e.g. v24).
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 || { echo "node 22 not installed; run: nvm install 22"; exit 1; }

npm cache clean --force && rm -rf node_modules && npm install && npm run dev
