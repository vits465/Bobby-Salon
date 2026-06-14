import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamically import fluent-ffmpeg
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const collectionDir = path.join(__dirname, '..', '..', 'public', 'gallery', 'collection');

const files = fs.readdirSync(collectionDir);
const movFiles = files.filter(f => path.extname(f).toLowerCase() === '.mov');

if (movFiles.length === 0) {
  console.log('✅ No MOV files found — nothing to convert.');
  process.exit(0);
}

console.log(`\n🎬 Found ${movFiles.length} MOV files to convert to MP4...\n`);

let completed = 0;
let failed = 0;

const convertFile = (file) => {
  return new Promise((resolve) => {
    const inputPath = path.join(collectionDir, file);
    const outputName = file.replace(/\.MOV$/i, '.mp4');
    const outputPath = path.join(collectionDir, outputName);

    // Skip if already converted
    if (fs.existsSync(outputPath)) {
      console.log(`⏭  Skipping ${file} (already converted)`);
      resolve();
      return;
    }

    console.log(`⏳ Converting: ${file} → ${outputName}`);

    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-crf 28',          // Quality (lower = better, 28 is good for web)
        '-preset fast',     // Fast encoding
        '-movflags +faststart', // Web optimized: allows streaming to start before full download
        '-vf scale=-2:720', // Scale to 720p height, keep aspect ratio
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r  Progress: ${Math.round(progress.percent)}%    `);
        }
      })
      .on('end', () => {
        process.stdout.write('\n');
        console.log(`✅ Done: ${outputName}`);
        completed++;
        resolve();
      })
      .on('error', (err) => {
        process.stdout.write('\n');
        console.error(`❌ Failed: ${file} — ${err.message}`);
        failed++;
        resolve(); // Don't reject — continue with others
      })
      .run();
  });
};

// Convert one at a time to avoid memory issues
(async () => {
  for (const file of movFiles) {
    await convertFile(file);
  }

  console.log(`\n🏁 Conversion complete!`);
  console.log(`   ✅ Converted: ${completed}`);
  console.log(`   ❌ Failed:    ${failed}`);
  console.log(`   ⏭  Skipped:   ${movFiles.length - completed - failed}`);
  console.log(`\nYou can now delete the original .MOV files if desired.\n`);
})();
