import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =================================================================
// 1. KODE SCRAPER UPSCALER (MURNI DARI BOS FARIS)
// =================================================================
async function imageUpscaler(filePath) {
  try {
    const res = await fetch('https://www.iloveimg.com/id/tingkatkan-gambar', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = await res.text();
    
    const token = html.match(/"token":"([^"]+)"/)?.[1];
    const taskId = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)?.[1];

    if (!token || !taskId) {
      throw new Error('Gagal ambil token/taskId');
    }

    const fileName = filePath.split('/').pop();
    const fileBuffer = fs.readFileSync(filePath);

    const form = new FormData();
    form.append('name', fileName);
    form.append('chunk', '0');
    form.append('chunks', '1');
    form.append('task', taskId);
    form.append('preview', '1');
    form.append('pdfinfo', '0');
    form.append('pdfforms', '0');
    form.append('pdfresetforms', '0');
    form.append('v', 'web.0');
    form.append('file', new Blob([fileBuffer]), fileName);

    const uploadRes = await fetch('https://api1g.iloveimg.com/v1/upload', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    const uploadData = await uploadRes.json();
    const serverFilename = uploadData.server_filename;

    const processForm = new FormData();
    processForm.append('packaged_filename', 'iloveimg-upscaled');
    processForm.append('multiplier', '2'); //support 2x dan 4x
    processForm.append('task', taskId);
    processForm.append('tool', 'upscaleimage');
    processForm.append('files[0][server_filename]', serverFilename);
    processForm.append('files[0][filename]', fileName);

    const processRes = await fetch('https://api1g.iloveimg.com/v1/process', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://www.iloveimg.com'
      },
      body: processForm
    });

    const processData = await processRes.json();

    if (processData.status !== 'TaskSuccess') {
      throw new Error('Processing failed');
    }

    return {
      success: true,
      results: {
        url: `https://api1g.iloveimg.com/v1/download/${taskId}`,
        filename: processData.download_filename,
        filesize: processData.output_filesize,
        extensions: processData.output_extensions,
        timer: processData.timer
      }
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// =================================================================
// 2. HANDLER BOT ACUMALAKA
// =================================================================
export default {
    command: ['upscale', 'hd', 'jernih'],
    execute: async (sock, m, { sender }) => {
        const isQuotedImage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        const isImage = m.message?.imageMessage;
        const targetMessage = isQuotedImage || isImage;

        if (!targetMessage) {
            return sock.sendMessage(sender, { 
                text: '❌ Reply fotonya dengan perintah *.hd* atau kirim foto dengan caption *.hd* Bos!' 
            }, { quoted: m });
        }

        await sock.sendMessage(sender, { text: '✨ Sedang menjernihkan gambar (Upscale 2x)...' }, { quoted: m });

        const outputDir = path.join(__dirname, '../../temp_downloads');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const tempFilePath = path.join(outputDir, `upscale_${Date.now()}.jpg`);

        try {
            // 1. Download gambar dari WA ke VPS (wajib agar scraper punya path file)
            const stream = await downloadContentFromMessage(targetMessage, 'image');
            let buffer = Buffer.from([]);
            for await(const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            fs.writeFileSync(tempFilePath, buffer);

            // 2. Eksekusi scraper bawaan
            const result = await imageUpscaler(tempFilePath);

            if (!result.success || !result.results?.url) {
                throw new Error(result.error || "Gagal memproses gambar di server.");
            }

            // 3. Kirim hasil gambar HD ke pengguna
            await sock.sendMessage(sender, { 
                image: { url: result.results.url }, 
                caption: '✅ *Berhasil dijernihkan!*' 
            }, { quoted: m });

        } catch (error) {
            console.error("Upscale Error:", error);
            sock.sendMessage(sender, { text: `❌ Gagal menjernihkan gambar: ${error.message}` }, { quoted: m });
        } finally {
            // 4. Bersihkan file mentah dari VPS
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }
};
