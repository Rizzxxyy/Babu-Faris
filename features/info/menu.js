import fs from 'fs';

// Helper: Menghitung Runtime
function runtime(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	return (d > 0 ? d + "d " : "") + (h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") + s + "s";
}

export default {
    command: ['menu', 'help', 'list'],
    execute: async (sock, m, { q, sender, pushName, isOwner }) => {
        
        // --- 1. FIX: ID CHAT AMAN ---
        const chatId = m.chat || m.key.remoteJid;
        if (!chatId) return;

        // --- 2. LOGIKA DETEKSI NAMA (LEBIH KUAT) ---
        // Cek variable pushName, kalau kosong cek m.pushName, kalau kosong pakai 'Tanpa Nama'
        const namaUser = pushName || m.pushName || 'Tanpa Nama';

        // --- 3. DATA LAINNYA ---
        const timeWIB = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
        const senderNumber = sender.split('@')[0];
        const status = isOwner ? '👑 Owner (God Mode)' : '⚔️ User';
        const botRuntime = runtime(process.uptime());

        // --- 4. ISI MENU ---
        let menuText = `
🌸 *I N F O   U S E R* 🌸
────────────────────
🍩 *Nama  :* ${namaUser}
📱 *Nomor :* ${senderNumber}
🎟️ *Status:* ${status}
⏰ *Jam   :* ${timeWIB}
⏱️ *Uptime:* ${botRuntime}

Halo ${namaUser}! 👋

🤖 *D A F T A R   F I T U R*
────────────────────

📥 *D O W N L O A D E R*
1.  *.ig* <link>
    (Instagram Video/Reel/Post)
2.  *.ig2* <link>
    (Instagram Versi Backup)
3.  *.tt* <link>
    (TikTok No Watermark)
4.  *.mediafire* / *.mf* <link>
    (MediaFire Downloader)
5.  *.mp3* <link>
    (YouTube to MP3)
6.  *.flac* <judul>
    (Download Lagu Hi-Res FLAC)

🎨 *M E D I A  &  T O O L S*
7.  *.sticker*
    (Gambar/Video ➡️ Sticker)
8.  *.brat* <teks>
    (Buat Sticker Teks Brat)
9.  *.upscale*
    (Perjernih Foto/HD)
10. *.removebg*
    (Hapus Background Foto)
11. *.upswgc*
    (Upload SW Grup)   

⛩️ *A N I M E  &  M A N G A*
12. *.komiku* <judul>
    (Cari/Baca Manga Indo)
13. *.animexin* <judul>
    (Cari Anime Terbaru)
14. *.kusonime* <judul>
    (Download Anime Batch)
15. *.mal* <judul>
    (Info Detail MyAnimeList)

⚙️ *S Y S T E M  &  O W N E R*
16. *.ping*
    (Cek Kecepatan Respon Bot)
17. *.neofetch*
    (Cek Info Spesifikasi VPS)
18. *.setpp*
    (Ganti Foto Profil Bot)

────────────────────
Created By Faris Suka Mie Ayam🔥🚀
`;

        // --- 5. CONFIG GAMBAR ---
        const imageUrl = 'https://files.catbox.moe/2txmah.jpg'; 

        try {
            await sock.sendMessage(chatId, { 
                image: { url: imageUrl }, 
                caption: menuText
            }, { quoted: m });

        } catch (error) {
            console.log("⚠️ Gambar error, kirim teks saja.");
            await sock.sendMessage(chatId, { text: menuText });
        }
    }
};
