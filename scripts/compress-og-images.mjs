import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { rename, stat } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const images = ["opengraph-image.png", "twitter-image.png"];

for (const filename of images) {
  const inputPath = join(publicDir, filename);
  const tmpPath = inputPath + ".tmp";

  await sharp(inputPath).png({ quality: 70, compressionLevel: 9, palette: true }).toFile(tmpPath);

  await rename(tmpPath, inputPath);

  const { size } = await stat(inputPath);
  console.log(`${filename}: ${(size / 1024).toFixed(1)} KB`);
}
