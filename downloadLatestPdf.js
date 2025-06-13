const axios = require("axios");
const fs = require("fs");
const path = require("path");

const PDF_URL =
  "https://ca.fierarealestate.com/wp-content/uploads/2023/09/Canadian-Rea-Estate-The-Worlds-Best-Kept-Secret_FINAL.pdf"; // replace with real URL
const LOCAL_DIR = path.join(__dirname, "./pdfs");
const LOCAL_PATH = path.join(LOCAL_DIR, "latest.pdf");

async function downloadLatestPdf() {
  // ✅ Make sure the /pdfs directory exists
  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
  }
  const response = await axios.get(PDF_URL, { responseType: "stream" });

  if (!response.headers["content-type"]?.includes("pdf")) {
    console.warn("⚠️ The URL may not return a PDF file.");
  }

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(LOCAL_PATH);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

module.exports = downloadLatestPdf;
