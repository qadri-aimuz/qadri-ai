const { Jimp } = require('jimp');

async function resize() {
  try {
    const image = await Jimp.read('public/logo.png');
    image.resize({ w: 256, h: 256 });
    await image.write('public/icon.png');
    console.log('Resized successfully');
  } catch(e) {
    console.error('Failed with named import, trying default', e);
    try {
      const defaultJimp = require('jimp');
      const img = await defaultJimp.read('public/logo.png');
      img.resize(256, 256);
      await img.writeAsync('public/icon.png');
      console.log('Resized successfully with default');
    } catch(e2) {
      console.error(e2);
    }
  }
}
resize();
