import { getContentType } from '@whiskeysockets/baileys';

export default {
   command: ['upswgc'],
   category: ['group'],
   desc: 'Unggah status grup saat ini.',
   execute: async (sock, m, { q, sender }) => {
       // --- DETEKSI PESAN & QUOTED (Sistem Raw Baileys) ---
       const msg = m.message;
       const isQuoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage;
       // Jika ada pesan yang di-reply, ambil pesan tersebut, jika tidak ambil pesan saat ini
       const targetMsg = isQuoted ? msg.extendedTextMessage.contextInfo.quotedMessage : msg;
       
       const type = getContentType(targetMsg);
       const mime = targetMsg[type]?.mimetype || '';
       let teks = q || '';
       
       if (!mime && !teks && !isQuoted) {
           return await sock.sendMessage(sender, { 
               text: `🍭 *Status Group*\n\n*Penggunaan:*\n.upswgc [teks] [--color:warna]\n\n*Daftar warna:*\n- biru\n- hijau\n- merah\n- kuning\nAtau bisa juga menggunakan HEX color (contoh: --color:ff00ff)` 
           }, { quoted: m });
       }

       // --- LOGIKA BACKGROUND COLOR ---
       const colorMap = { 
           'biru': '0xff26c4dc', 
           'merah': '0xffff0000', 
           'hijau': '0xff00ff00', 
           'kuning': '0xffffff00', 
           'hitam': '0xff000000' 
       };
       let bgColor = colorMap['hitam']; // Warna default
       
       if (teks.includes('--color:')) {
          let col = teks.split('--color:')[1].trim().split(' ')[0];
          bgColor = colorMap[col.toLowerCase()] || `0xff${col.replace('#', '')}`;
          teks = teks.replace(`--color:${col}`, '').trim();
       }
       
       const bgColorNumber = Number(bgColor);
       // ---------------------------------------------------------

       try {
          // Indikator loading menggunakan reaction
          await sock.sendMessage(sender, { react: { text: '⏳', key: m.key } });
     
          // Clone (duplikat) object pesan agar aman saat dimanipulasi
          let clonedMsg = JSON.parse(JSON.stringify(targetMsg)); 
          let clonedType = getContentType(clonedMsg);

          // Ubah tipe teks biasa menjadi extendedTextMessage agar bisa diberi warna background
          if (clonedType === 'conversation') {
             clonedMsg.extendedTextMessage = { text: isQuoted ? targetMsg.conversation : teks };
             delete clonedMsg.conversation;
             clonedType = 'extendedTextMessage';
          }

          // Menyisipkan teks/caption
          if (!isQuoted && clonedMsg[clonedType]) {
             if (clonedMsg[clonedType].caption !== undefined) {
                clonedMsg[clonedType].caption = teks; 
             } else if (clonedMsg[clonedType].text !== undefined) {
                clonedMsg[clonedType].text = teks;
             }
          } else if (isQuoted && teks) {
             if (clonedMsg[clonedType]) clonedMsg[clonedType].caption = teks;
          }

          // Menyisipkan warna background
          if (clonedType === 'extendedTextMessage') {
             if (!clonedMsg.extendedTextMessage) clonedMsg.extendedTextMessage = {};
             clonedMsg.extendedTextMessage.backgroundArgb = bgColorNumber;
          }

          // Membungkus pesan ke format Status Grup V2
          const WAMC = {
             groupStatusMessageV2: {
                message: clonedMsg
             }
          };
          
          let temp = WAMC;
          // Loop untuk memanipulasi struktur payload Baileys (Bypass)
          for (let i = 0; i < 5; i++) {
             const n = {
                groupStatusMessageV2 : {
                    message: temp
                }
             };
             temp = n;
          }
          
          // Mengirim pesan relay ke Grup (menggunakan variable sender/chatId)
          await sock.relayMessage(sender, temp, {});
          await sock.sendMessage(sender, { react: { text: '✅', key: m.key } });
          
       } catch (e) {
          console.error(e);
          await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat memproses status grup.' }, { quoted: m });
       }
   }
};

// Created By Faris Suka Mie Ayam🔥🚀
