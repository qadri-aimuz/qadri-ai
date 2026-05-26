const Jimp = require('jimp');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function buildIco() {
  const image = await Jimp.read('public/logo.png');
  image.resize(256, 256);
  await image.writeAsync('public/icon-256.png');
  const buf = await pngToIco('public/icon-256.png');
  fs.writeFileSync('public/icon.ico', buf);
  console.log('Valid icon created successfully');
}
buildIco().catch(console.error);
