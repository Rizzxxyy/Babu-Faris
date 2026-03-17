import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =================================================================
// 1. CLASS SCRAPER (DARI FONGSIDEV)
// =================================================================
export class AppleMusicDownloader {
  constructor() {
    this.baseUrl = "https://aaplmusicdownloader.com";
    this.userAgent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36";
    this.headers = {
      authority: "aaplmusicdownloader.com",
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": this.userAgent,
      "x-requested-with": "XMLHttpRequest",
    };
  }

  async search(url) {
    const response = await axios.get(`${this.baseUrl}/api/applesearch.php`, {
      params: { url },
      headers: { ...this.headers, referer: `${this.baseUrl}/` },
    });
    return response.data;
  }

  async getSessionCookie() {
    const response = await axios.get(this.baseUrl, {
      headers: { ...this.headers, referer: `${this.baseUrl}/` },
    });
    const setCookie = response.headers["set-cookie"]?.[0];
    if (!setCookie) throw new Error("No Set-Cookie header found");
    return setCookie.split(";")[0];
  }

  async download({ songName, artistName, url, quality = "m4a", zipDownload = false }) {
    const cookie = await this.getSessionCookie();
    const form = new URLSearchParams({
      song_name: songName,
      artist_name: artistName,
      url,
      token: "none",
      zip_download: zipDownload.toString(),
      quality,
    });

    const response = await axios.post(`${this.baseUrl}/api/composer/swd.php`, form, {
      headers: {
        ...this.headers,
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        cookie: cookie,
        origin: this.baseUrl,
        referer: `${this.baseUrl}/song.php`,
      },
    });
    return response.data;
  }
}

// =================================================================
// 2. DOWNLOADER STREAM (HEMAT RAM)
// =================================================================
async function downloadFile(url, outputLocation) {
    const writer = fs.createWriteStream(outputLocation);
    const response = await axios({
        url, method: 'GET', responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// =================================================================
// 3. HANDLER BOT ACUMALAKA
// =================================================================
export default {
    command: ['applemusic', 'apple', 'amdl'],
    execute: async (sock, m, { q, sender }) => {
        if (!q || !q.includes('music.apple.com')) {
            return sock.sendMessage(sender, { 
                text: '❌ Kirim link Apple Music yang valid, Bos!\nContoh: *.applemusic https://music.apple.com/us/album/...*' 
            }, { quoted: m });
        }

        await sock.sendMessage(sender, { text: '🎵 *BOT ACUMALAKA* sedang mengunduh lagu dari Apple Music...' }, { quoted: m });

        try {
            const downloader = new AppleMusicDownloader();
            
            // 1. Cari data lagu
            const searchResult = await downloader.search(q);
            if (!searchResult || !searchResult.name) {
                return sock.sendMessage(sender, { text: '❌ Lagu tidak ditemukan.' }, { quoted: m });
            }

            // 2. Dapatkan link download M4A
            const downloadResult = await downloader.download({
                songName: searchResult.name,
                artistName: searchResult.artist,
                url: searchResult.url,
                quality: "m4a",
            });

            const audioUrl = downloadResult.dlink || downloadResult.url || downloadResult.link || downloadResult;

            if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) {
                throw new Error("Gagal mendapatkan link audio murni.");
            }

            // 3. Siapkan direktori dan file
            const outputDir = path.join(__dirname, '../../temp_downloads');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const fileName = `AppleMusic_${Date.now()}.m4a`;
            const filePath = path.join(outputDir, fileName);

            // 4. Download ke VPS dan kirim ke user
            await downloadFile(audioUrl, filePath);

            const captionInfo = `🍎 *APPLE MUSIC DOWNLOADER*\n\n` +
                                `🎵 *Judul:* ${searchResult.name}\n` +
                                `👤 *Artis:* ${searchResult.artist}\n` +
                                `💿 *Album:* ${searchResult.album || '-'}\n\n` +
                                `_Sedang mengirim audio..._`;

            // Kirim Thumbnail/Info Dulu
            if (searchResult.thumb) {
                await sock.sendMessage(sender, { image: { url: searchResult.thumb }, caption: captionInfo }, { quoted: m });
            } else {
                await sock.sendMessage(sender, { text: captionInfo }, { quoted: m });
            }

            // Kirim Audio
            await sock.sendMessage(sender, { 
                audio: { url: filePath }, 
                mimetype: 'audio/mp4',
                ptt: false 
            }, { quoted: m });

            // 5. Bersihkan file sampah
            setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 5000);

        } catch (error) {
            console.error("Apple Music Error:", error);
            sock.sendMessage(sender, { text: `❌ Terjadi kesalahan: ${error.message || 'Server sedang sibuk.'}` }, { quoted: m });
        }
    }
};
