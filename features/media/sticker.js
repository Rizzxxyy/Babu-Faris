import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    command: ['s', 'stiker', 'sticker'],
    execute: async (sock, m, { q }) => {
        // Ambil ID Chat agar aman
        const chatId = m.chat || m.key.remoteJid;

        // 1. Deteksi apakah user membalas pesan media atau mengirim langsung
        const isQuoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const targetMsg = isQuoted ? m.message.extendedTextMessage.contextInfo.quotedMessage : m.message;
        
        if (!targetMsg) {
            return sock.sendMessage(chatId, { text: '❌ Kirim gambar/GIF dengan caption .s atau balas pesannya.' }, { quoted: m });
        }

        // 2. Cari tahu tipe medianya (Gambar atau Video/GIF)
        let messageType = Object.keys(targetMsg).find(key => ['imageMessage', 'videoMessage', 'documentMessage'].includes(key));
        
        if (!messageType) {
            return sock.sendMessage(chatId, { text: '❌ Hanya support format Gambar dan Video/GIF.' }, { quoted: m });
        }

        const mediaMessage = targetMsg[messageType];
        const isVideo = messageType === 'videoMessage' || (messageType === 'documentMessage' && mediaMessage.mimetype?.includes('video'));

        // Batasi durasi GIF maks 15 detik agar RAM VPS 2GB Bos tidak nge-hang
        if (isVideo && mediaMessage.seconds > 15) {
            return sock.sendMessage(chatId, { text: '❌ Durasi GIF/Video maksimal 15 detik!' }, { quoted: m });
        }

        await sock.sendMessage(chatId, { text: '⏳ Memproses stiker...' }, { quoted: m });

        // 3. Siapkan lokasi penyimpanan sementara
        const ext = isVideo ? 'mp4' : 'jpg';
        const tempDir = path.join(__dirname, '../../temp_downloads');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const inputPath = path.join(tempDir, `stiker_in_${Date.now()}.${ext}`);
        const outputPath = path.join(tempDir, `stiker_out_${Date.now()}.webp`);

        try {
            // 4. Download file asli
            const stream = await downloadContentFromMessage(mediaMessage, isVideo ? 'video' : 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            fs.writeFileSync(inputPath, buffer);

            // 5. EKSEKUSI FFMPEG (Jurus Anti Kekecilan & Anti Blank)
            // scale=512:512:force_original_aspect_ratio=decrease -> Skala pas ke ukuran stiker
            // format=rgba -> Paksa output pakai warna asli (Memperbaiki GIF kosong)
            // pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000 -> Tambah pinggiran transparan
            let ffmpegCmd = '';
            
            if (isVideo) {
                ffmpegCmd = `ffmpeg -i "${inputPath}" -vcodec libwebp -filter_complex "[0:v] scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15" -loop 0 -preset default -an -vsync 0 -t 00:00:10 "${outputPath}"`;
            } else {
                ffmpegCmd = `ffmpeg -i "${inputPath}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" "${outputPath}"`;
            }

            // Jalankan command
            await execPromise(ffmpegCmd);

            // 6. Kirim Stiker ke WhatsApp (Gunakan method { url: path } agar RAM irit)
            await sock.sendMessage(chatId, { sticker: { url: outputPath } }, { quoted: m });

        } catch (error) {
            console.error("Sticker Error:", error);
            sock.sendMessage(chatId, { text: '❌ Gagal membuat stiker. Terjadi kesalahan pada proses rendering.' }, { quoted: m });
        } finally {
            // 7. Bersihkan file sampah
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
    }
};
