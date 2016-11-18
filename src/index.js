#!/usr/bin/env node
'use strict';

const argv = require('yargs')
  .usage('Usage: $0 -i [file] -o [dir]')
  .demand(['inputFile', 'outputDirectory'])
  .alias('inputFile', 'i')
  .alias('outputDirectory', 'o')
  .alias('smushLayers', 's')
  .alias('stitchTiles', 'l')
  .alias('stitchWidth', 'w')
  .default('stitchWidth', 10)
  .boolean('smushLayers')
  .boolean('stitchTiles')
  .describe('inputFile', 'The .pyxel file you wish to export.')
  .describe('outputDirectory', 'The directory where I put the exported tiles.')
  .describe('smushLayers', 'Smush all the layers and export the result.')
  .describe('stitchTiles', 'Grab all the tiles from the Pyxel file and stitch them into one image.')
  .describe('stitchWidth', 'How wide the final stitched sheet is.')
  .example('$0 -i stoneTiles.pyxel -o assets/build', 'export all the tiles in stoneTiles.pyxel to assets/build')
  .example('$0 -i player.pyxel -o assets/build -s', 'export all the tiles in player.pyxel after first smushing the layers together')
  .example('$0 -i stoneTiles.pyxel -o assets/build -l -w 10', 'export one sheet of tiles with the given width')
  .argv;

const path = require('path');
const AdmZip = require('adm-zip');
const Jimp = require('jimp');
const Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

const inputFile = new AdmZip(argv.inputFile);
const entries = inputFile.getEntries();

// Gotta find docData.json. That's the metadata about the images within.
const docDataFile = inputFile.getEntry('docData.json');
if (!docDataFile) {
  throw Error(`Missing docData.json in ${argv.inputFile}`);
}
const docData = JSON.parse(inputFile.readFile(docDataFile).toString());

// Cache the decoding of files for quicker access later.
const imageHash = new Map();
function getImage(name) {
  if (imageHash.has(name)) {
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

function generateOutfilename(index = '') {
  return path.join(argv.outputDirectory, `${path.basename(argv.inputFile, '.pyxel')}${index}.png`);
}

function smushLayers() {
  // All the tiles in this thing. Each is an array of an image that we'll squash later.
  const outputTiles = new Map();
  // Do in reverse order cuz we're applying composite, one on top of another.
  const layerKeys = Object.keys(docData.canvas.layers).reverse();
  return Promise.resolve(layerKeys)
    .map(layerKey => docData.canvas.layers[layerKey])
    .filter(layer => !layer.hidden)
    .map(layer => {
      return Promise.resolve(Object.keys(layer.tileRefs))
        .map(tileRefKey => {
          const tileRef = layer.tileRefs[tileRefKey];
          let outputTile = outputTiles.get(tileRefKey);
          if (!outputTile) {
            // TODO: Support tileset fixedWidth === false
            outputTile = new Jimp(docData.tileset.tileWidth, docData.tileset.tileHeight);
            outputTiles.set(tileRefKey, outputTile);
          }
          return getImage(`tile${tileRef.index}.png`)
            .then(tile => {
              // TODO: Support layer alpha, blendmode
              // TODO: Support tile rotation and flip
              outputTile.composite(tile, 0, 0);
            })
            .catch(e => {
              console.error(e);
            });
        })
    })
    .then(() => {
      outputTiles.forEach((value, key) => {
        value.write(generateOutfilename(key), function (error, img) {
          if (error) {
            throw error;
          }
        });
      });
    });
}

function getAllTheTilenames() {
  return Promise.resolve(new Array(docData.tileset.numTiles))
    // Generate the filenames in the input file.
    .map((_, i) => `tile${i}.png`)
}

function stitchTiles() {
  const { tileWidth, tileHeight, numTiles } = docData.tileset;
  const width = argv.stitchWidth * tileWidth;
  const height = Math.ceil(numTiles / argv.stitchWidth) * tileHeight;

  return new Promise((resolve, reject) => {
    const image = new Jimp(width, height, (err, image) => {
      if (err) {
        reject(err);
      } else {
        resolve(image);
      }
    });
  })
    .then(image => {
      return getAllTheTilenames()
        .map(getImage)
        .map((tileImage, i) => {
          const x = i % argv.stitchWidth;
          const y = Math.floor(i / argv.stitchWidth);
          const tileX = x * tileWidth;
          const tileY = y * tileHeight;
          return image.blit(tileImage, tileX, tileY);
        })
        .then(() => image)
    })
    .then(image => image.write(generateOutfilename()))
    .catch(e => {
      console.error(e);
    })
}

function exportTheTiles() {
  // Easy peasey. Write out all the tile files in a format matching the inputFile tilename.
  return getAllTheTilenames()
    .map(filename => inputFile.getEntry(filename))
    .map((zipEntry, i) => fs.writeFileAsync(generateOutfilename(i), zipEntry.getData()))
    .catch(e => {
      console.error(e);
    });
}

if (argv.smushLayers) {
  smushLayers();
} if (argv.stitchTiles) {
  stitchTiles();
} else {
  exportTheTiles();
}
