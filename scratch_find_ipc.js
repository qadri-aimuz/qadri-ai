const fs = require('fs');
const code = fs.readFileSync('dist/assets/index-DQcpTG9L.js', 'utf8');
const matches = code.match(/invoke\(['"][a-zA-Z0-9_-]+['"]/g);
console.log([...new Set(matches)]);
