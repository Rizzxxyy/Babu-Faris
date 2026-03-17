import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEADERS = {
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
};

// =================================================================
// 1. FUNGSI PENCARIAN SFILE (UPDATE DOMAIN SFILE.CO)
// =================================================================
async function searchSfile(query) {
    // Menggunakan endpoint pencarian terbaru dari sfile.co
    const url = `https://sfile.co/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(res.data);
    const results = [];

    $('.list').each((i, el) => {
        const aTag = $(el).find('a');
        const title = aTag.text().trim();
        const link = aTag.attr('href');
        
        // Mendukung link lama (.mobi) dan baru (.co)
        if (title && link && (link.includes('sfile.mobi/') || link.includes('sfile.co/'))) {
            results.push({ title, link });
        }
    });

    return results;
}

// =================================================================
// 2. FUNGSI SCRAPER SFILE (BYPASS LINK)
// =================================================================
async function scrapeSfile(url) {
  const headers = {
    authority: "sfile.co", // Update authority
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "max-age=0",
    referer: "https://sfile.co/", // Update referer
    "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": HEADERS["user-agent"],
  };

  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);

  const fileContent = $(".file-content").first();
  const name = fileContent.find("h1.intro").text().trim();
  const file_type = fileContent.find(".list").eq(0).text().split("-")[1]?.trim() || "Unknown";
  const uploaded_by = fileContent.find(".list").eq(1).find("a").first().text().trim() || "Unknown";
  const uploaded_at = fileContent.find(".list").eq(2).text().split(":")[1]?.trim() || "Unknown";
  let downloads = 0;
  
  try {
      downloads = parseInt(fileContent.find(".list").eq(3).text().split(":")[1].trim(), 10);
  } catch (e) {
      downloads = 0;
  }
  
  const download_url = $("#download").attr("href");

  if (!download_url) throw new Error("Link download asli tidak ditemukan di halaman.");

  const cookie = (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

  const { data: downloadPage } = await axios.get(download_url, {
    headers: { ...headers, cookie },
  });

  const $$ = cheerio.load(downloadPage);
  const scripts = $$("script").toArray();

  let finalDownloadUrl = null;
  for (const script of scripts) {
    const content = $$(script).html();
    const match = content?.match(/sf\s*=\s*"([^"]+)"/);
    if (match) {
      finalDownloadUrl = JSON.parse(`"${match[1]}"`);
      break;
    }
  }

  return { name, uploaded_by, uploaded_at, downloads, file_type, download_url: finalDownloadUrl };
}

// =================================================================
// 3. DOWNLOADER STREAM (ANTI RAM JEBOL)
// =================================================================
async function downloadFile(url, outputLocation) {
    const writer = fs.createWriteStream(outputLocation);
    const response = await axios({
        url, method: 'GET', responseType: 'stream',
        headers: { 
            'User-Agent': HEADERS["user-agent"],
            'Referer': 'https://sfile.co/' // Update referer
        }
    });
    
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// =================================================================
// 4. HANDLER BOT ACUMALAKA (OTOMATIS CARI & KIRIM)
// =================================================================
export default {
    command: ['sfile', 'sfiledl', 'sf', 'carisfile'],
    execute: async (sock, m, { q, sender }) => {
        // Cek apakah user memasukkan kata kunci pencarian
        if (!q) {
            return sock.sendMessage(sender, { 
                text: '❌ Masukkan nama file yang ingin dicari, Bos!\n*Contoh:* .sfile whatsapp mod clone' 
            }, { quoted: m });
        }

        await sock.sendMessage(sender, { text: `🔍 Sedang mencari *"${q}"* di SFile...` }, { quoted: m });

        try {
            // 1. Lakukan Pencarian
            const searchResults = await searchSfile(q);

            if (searchResults.length === 0) {
                return sock.sendMessage(sender, { text: `❌ File dengan nama "${q}" tidak ditemukan di server SFile.` }, { quoted: m });
            }

            // Ambil hasil paling atas (peringkat 1)
            const topResult = searchResults[0];
            await sock.sendMessage(sender, { text: `✅ Menemukan: *${topResult.title}*\n⏳ Sedang mengunduh dan menyiapkan dokumen...` }, { quoted: m });

            // 2. Ekstrak Direct Link dari hasil pencarian tersebut
            const result = await scrapeSfile(topResult.link);
            
            if (!result || !result.download_url) {
                throw new Error("Gagal mendapatkan link download langsung (file mungkin dikunci atau dihapus).");
            }

            // 3. Siapkan File Sementara di VPS
            const outputDir = path.join(__dirname, '../../temp_downloads');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            // Bersihkan nama file dari karakter yang bisa menyebabkan error
            const safeFileName = result.name.replace(/[^a-zA-Z0-9.\-_ ]/g, '') || `Sfile_${Date.now()}.bin`;
            const filePath = path.join(outputDir, safeFileName);

            // 4. Download Stream ke VPS
            await downloadFile(result.download_url, filePath);

            const captionInfo = `📁 *SFILE DOWNLOADER*\n\n` +
                                `📄 *Nama:* ${result.name}\n` +
                                `📝 *Tipe:* ${result.file_type}\n` +
                                `👤 *Diunggah:* ${result.uploaded_by}\n` +
                                `📥 *Diunduh:* ${result.downloads} kali`;

            // 5. Kirim Dokumen ke WhatsApp
            await sock.sendMessage(sender, { 
                document: { url: filePath }, 
                mimetype: 'application/octet-stream',
                fileName: safeFileName,
                caption: captionInfo 
            }, { quoted: m });

            // 6. Bersihkan file sampah dari VPS setelah 10 detik
            setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 10000);

        } catch (error) {
            console.error("SFile Automation Error:", error);
            sock.sendMessage(sender, { text: `❌ Terjadi kesalahan: ${error.message}` }, { quoted: m });
        }
    }
};
