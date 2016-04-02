'use strict';

const argv = require('yargs')
  .usage('Usage: $0 -i [file] -o [dir]')
  .demand(['i', 'o'])
  .alias('i', 'inputFile')
  .alias('o', 'outputDirectory')
  .describe('i', 'The .pyxel file you wish to export.')
  .describe('o', 'The directory where I put the exported tiles.')
  .example('$0 -i player.pyxel -o assets/build', 'export all the tiles in player.pyxel to assets/build')
  .argv;

const path = require('path');
const AdmZip = require('adm-zip');
const Jimp = require('jimp');

const inputFile = new AdmZip(argv.inputFile);
const entries = inputFile.getEntries();

// Gotta find docData.json. That's the metadata about the images within.
const docDataFile = inputFile.getEntry('docData.json');
if (!docDataFile) {
  throw Error(`Missing docData.json in ${argv.inputFile}`);
}
const docData = JSON.parse(inputFile.readFile(docDataFile).toString());
const layerKeys = Object.keys(docData.canvas.layers).reverse();

// Cache the decoding of files for quicker access later.
const imageHash = new Map();
function getImage(name) {
  if (imageHash.has(name)) {
    console.log('hit');
    return Promise.resolve(imageHash.get(name));
  }
  const entry = inputFile.getEntry(name);
  const buffer = inputFile.readFile(entry);
  return Jimp.read(buffer)
  .then(image => {
    imageHash.set(name, image);
    return image;
  })
  .catch(e => {
    console.error(e);
  })
}

// All the tiles in this thing. Each is an array of an image that we'll squash later.
const outputTiles = new Map();

Promise.all(layerKeys.map(layerKey => {
  const layer = docData.canvas.layers[layerKey];
  return Promise.all(Object.keys(layer.tileRefs).map(tileRefKey => {
    const tileRef = layer.tileRefs[tileRefKey];
    let outputTile = outputTiles.get(tileRefKey);
    if (!outputTile) {
      outputTile = new Jimp(docData.tileset.tileWidth, docData.tileset.tileHeight);
      outputTiles.set(tileRefKey, outputTile);
    }
    return getImage(`tile${tileRef.index}.png`)
    .then(tile => {
      outputTile.composite(tile, 0, 0);
    })
    .catch(e => {
      console.error(e);
    });
  }));
}))
.then(() => {
  outputTiles.forEach((value, key) => {
    const outPath = path.join(argv.outputDirectory, `${path.basename(argv.inputFile, '.pyxel')}${key}.png`);
    value.write(outPath, function (error, img) {
    });
  });
});
