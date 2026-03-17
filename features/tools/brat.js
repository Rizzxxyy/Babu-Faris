import { Sticker } from 'wa-sticker-formatter';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    command: ['brat', 'stikerbrat', 'sbrat'],
    execute: async (sock, m, { q, sender }) => {
        let text = q;

        // Cek apakah Bos me-reply pesan teks orang lain
        if (!text && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
            text = quoted.conversation || quoted.extendedTextMessage?.text || '';
        }

        // Jika tidak ada teks sama sekali
        if (!text) {
            return sock.sendMessage(sender, { 
                text: '❌ Masukkan teksnya atau reply pesan orang lain!\n*Contoh:* .brat Halo semuanya!' 
            }, { quoted: m });
        }

        // Beri reaksi jam (menunggu) - Opsional jika sistem bot Bos mendukung m.react
        try {
            await sock.sendMessage(sender, { react: { text: "🕒", key: m.key } });
        } catch (e) {}

        try {
            // URL API Brat
            const apiUrl = `https://aqul-brat.hf.space?text=${encodeURIComponent(text)}`;

            // Proses pembuatan stiker dengan Metadata (Exif)
            const sticker = new Sticker(apiUrl, {
                pack: 'BOT ACUMALAKA',          // Nama Pack Stiker
                author: 'Faris Suka Mie Ayam🔥🚀', // Nama Pembuat
                type: 'full',                   // 'crop' atau 'full'
                quality: 50                     // Kualitas gambar (0-100)
            });

            // Jadikan buffer
            const buffer = await sticker.toBuffer();

            // Beri reaksi centang
            try {
                await sock.sendMessage(sender, { react: { text: "✅", key: m.key } });
            } catch (e) {}

            // Kirim ke WhatsApp
            await sock.sendMessage(sender, { 
                sticker: buffer 
            }, { quoted: m });

        } catch (error) {
            console.error("Brat Sticker Error:", error);
            
            // Beri reaksi silang kalau gagal
            try {
                await sock.sendMessage(sender, { react: { text: "❌", key: m.key } });
            } catch (e) {}

            sock.sendMessage(sender, { text: `❌ Gagal membuat stiker Brat. Server mungkin sedang sibuk.` }, { quoted: m });
        }
    }
};
