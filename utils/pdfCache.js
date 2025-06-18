// utils/pdfCache.js
const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");

const pdfCache = {}; // key: filename, value: clean text

// async function preloadPDFs() {
//   try {
//     const pdfDir = path.join(__dirname, "../pdfs");
//     const files = (await fs.readdir(pdfDir)).filter((f) => f.endsWith(".pdf"));

//     for (const file of files) {
//       const filePath = path.join(pdfDir, file);
//       const dataBuffer = await fs.readFile(filePath);
//       const pdfData = await pdfParse(dataBuffer);
//       const text = pdfData.text.replace(/\s+/g, " ").trim();
//       pdfCache[file] = text;
//     }

//     console.log(`✅ Preloaded ${Object.keys(pdfCache).length} PDFs.`);
//   } catch (err) {
//     console.error("❌ PDF preload error:", err.message);
//   }
// }
async function preloadPDFs() {
  console.log("preload pdf called");
  try {
    const pdfDir = path.join(__dirname, "../pdfs");
    const files = (await fs.readdir(pdfDir)).filter((f) => f.endsWith(".pdf"));

    if (files.length === 0) {
      console.log("⚠️ No PDF files found in /pdfs directory.");
    }

    // for (const file of files) {
    //   const filePath = path.join(pdfDir, file);
    //   const dataBuffer = await fs.readFile(filePath);
    //   const pdfData = await pdfParse(dataBuffer);
    //   const text = pdfData.text.replace(/\s+/g, " ").trim();
    //   pdfCache[file] = text;

    //   console.log(`✅ Parsed PDF: ${file} (${text.length} chars)`);
    // }

    for (const file of files) {
      try {
        const filePath = path.join(pdfDir, file);
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        const text = pdfData.text.replace(/\s+/g, " ").trim();
        pdfCache[file] = text;
        console.log(`✅ Parsed PDF: ${file} (${text.length} chars)`);
      } catch (err) {
        console.error(`❌ Failed to parse: ${file} – ${err.message}`);
      }
    }

    console.log(
      `🗂️ Total PDFs loaded into memory: ${Object.keys(pdfCache).length}`
    );
  } catch (err) {
    console.error("❌ PDF preload error:", err.message);
  }
}

function searchPDFCache(query) {
  const lowerQuery = query.toLowerCase();
  const results = [];

  for (const [filename, text] of Object.entries(pdfCache)) {
    if (text.toLowerCase().includes(lowerQuery)) {
      results.push(`From: ${filename}\n${text.slice(0, 1500)}\n\n`);
    }
  }

  return results.length > 0 ? results.join("") : null;
}

module.exports = { preloadPDFs, searchPDFCache };
