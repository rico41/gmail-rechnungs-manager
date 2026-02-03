/**
 * Icon Generator Script
 * Generiert einfache Platzhalter-Icons für die Extension
 * 
 * Für Produktions-Icons sollten richtige PNG-Dateien erstellt werden.
 */

const fs = require('fs');
const path = require('path');

// Minimale PNG-Header für verschiedene Größen
// Diese generieren einfache einfarbige Icons
const generateSimplePng = (size, r, g, b) => {
  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(2, 9);        // color type (RGB)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace
  
  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc
  ]);
  
  // IDAT chunk - uncompressed image data
  // Simple solid color fill
  const rowSize = 1 + size * 3; // filter byte + RGB for each pixel
  const rawData = Buffer.alloc(rowSize * size);
  
  for (let y = 0; y < size; y++) {
    rawData[y * rowSize] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }
  
  // Use zlib to compress
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);
  const idat = Buffer.concat([
    idatLength,
    Buffer.from('IDAT'),
    compressed,
    idatCrc
  ]);
  
  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    iendCrc
  ]);
  
  return Buffer.concat([signature, ihdr, idat, iend]);
};

// CRC32 implementation for PNG
const crc32 = (data) => {
  let crc = 0xffffffff;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  
  crc = crc ^ 0xffffffff;
  
  const result = Buffer.alloc(4);
  result.writeUInt32BE(crc >>> 0, 0);
  return result;
};

// Icon sizes
const sizes = [16, 32, 48, 128];

// Primary color (similar to our blue theme)
const color = { r: 14, g: 165, b: 233 }; // #0ea5e9

// Output directory
const outputDir = path.join(__dirname, '..', 'assets', 'icons');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate icons
sizes.forEach(size => {
  const png = generateSimplePng(size, color.r, color.g, color.b);
  const filename = `icon${size}.png`;
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, png);
  console.log(`✓ Generated ${filename}`);
});

console.log('\nPlatzhalter-Icons wurden erstellt.');
console.log('Für Produktions-Release sollten richtige Icons mit Logo erstellt werden.');
