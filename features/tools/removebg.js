import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =================================================================
// 1. KODE SCRAPER REMOVEBG (FIXED UPLOAD HEADER)
// =================================================================
async function removeBg(filePath) {
  try {
    const form = new FormData();
    // FIX: Tambahkan nama file dummy agar API tidak bingung membaca stream
    form.append("file", fs.createReadStream(filePath), "image.jpg");

    const res = await axios.post("https://removebg.one/api/predict/v2", form, {
      headers: {
        ...form.getHeaders(),
        "accept": "application/json, text/plain, */*",
        "locale": "en-US",
        "platform": "PC",
        "product": "REMOVEBG",
        "sec-ch-ua": "\"Chromium\";v=\"127\", \"Not)A;Brand\";v=\"99\", \"Microsoft Edge Simulate\";v=\"127\", \"Lemur\";v=\"127\"",
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": "\"Android\"",
        "Referer": "https://removebg.one/upload"
      }
    });

    const data = res.data?.data;
    if (!data || !data.cutoutUrl) {
        // Cek log di PM2 jika server mengembalikan respon tak terduga
        console.error("Respon API Aneh:", res.data);
        throw new Error("Server gagal mengembalikan link gambar transparan.");
    }
    
    return data.cutoutUrl;

  } catch (e) {
    // Tangkap error langsung dari respon server API (jika ada)
    const serverError = e.response?.data?.message || e.message;
    console.error("Axios API Error:", e.response?.data || e.message);
    throw new Error(serverError);
  }
}

// =================================================================
// 2. HANDLER BOT ACUMALAKA
// =================================================================
export default {
    command: ['removebg', 'rmbg', 'nobg'],
    execute: async (sock, m, { sender }) => {
        const isQuotedImage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        const isImage = m.message?.imageMessage;
        const targetMessage = isQuotedImage || isImage;

        if (!targetMessage) {
            return sock.sendMessage(sender, { 
                text: '❌ Reply fotonya dengan perintah *.rmbg* atau kirim foto dengan caption *.rmbg* Bos!' 
            }, { quoted: m });
        }

        await sock.sendMessage(sender, { text: '✂️ Sedang menghapus latar belakang gambar, mohon tunggu...' }, { quoted: m });

        const outputDir = path.join(__dirname, '../../temp_downloads');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const tempFilePath = path.join(outputDir, `rmbg_input_${Date.now()}.jpg`);

        try {
            const stream = await downloadContentFromMessage(targetMessage, 'image');
            let buffer = Buffer.from([]);
            for await(const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            fs.writeFileSync(tempFilePath, buffer);

            const cutoutUrl = await removeBg(tempFilePath);

            await sock.sendMessage(sender, { 
                document: { url: cutoutUrl }, 
                mimetype: 'image/png',
                fileName: `RemoveBG_${Date.now()}.png`,
                caption: '✅ *Berhasil menghapus background!*\n_Gambar dikirim sebagai dokumen agar transparansinya terjaga._' 
            }, { quoted: m });

        } catch (error) {
            console.error("RemoveBG Error:", error);
            sock.sendMessage(sender, { text: `❌ Gagal memproses gambar: ${error.message}` }, { quoted: m });
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }
};
