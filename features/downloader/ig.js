import * as config from '../../config.js';
import { reelsvideo } from '../../src/scraper/reelsvideo.js';

export default {
    command: ['ig'],
    execute: async (sock, m, { sender }) => {
        const chatId = m.key.remoteJid;
        
        // AMBIL TEKS: Mengambil pesan utuh dari struktur Baileys yang paling dalam
        const fullText = m.message?.conversation || m.message?.extendedTextMessage?.text || m.text || '';

        // DETEKSI URL: Langsung cari link Instagram di dalam teks pesan menggunakan Regex
        const urlMatch = fullText.match(/https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|stories|tv)\/[^\s]+/i);
        const url = urlMatch ? urlMatch[0] : null;

        if (!url) {
            return sock.sendMessage(chatId, { 
                text: `📸 *ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
                      `> \`.ig <url>\`\n\n` +
                      `*ᴄᴏɴᴛᴏʜ:*\n` +
                      `> \`.ig https://www.instagram.com/reel/xxx\`` 
            }, { quoted: m });
        }

        // Memberikan reaction ⏳ tanda sedang memproses
        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const result = await reelsvideo(url);

            if (!result || result.type === 'unknown' || (!result.videos?.length && !result.images?.length)) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(chatId, { 
                    text: `❌ Gagal mengambil media atau link di-private. Coba link lain.` 
                }, { quoted: m });
            }

            // Pengaturan Saluran (Channel) Forwarding
            const saluranId = config.saluran?.id || '120363208449943317@newsletter';
            const saluranName = config.saluran?.name || 'BOT ACUMALAKA';
            
            const ctxInfo = {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            };

            const typeLabel = {
                video: '🎬 Video',
                photo: '🖼️ Foto',
                carousel: '📸 Carousel'
            };

            // Menambahkan teks Caption dari Instagram (jika ada)
            const captionText = result.caption ? `\n\n📝 *Caption:*\n${result.caption}` : '';

            // Menggabungkan semua elemen menjadi pesan final
            const caption =
                `✅ *ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
                `> ${typeLabel[result.type] || '📦 Media'}` +
                (result.username ? `\n> 👤 @${result.username}` : '') +
                captionText +
                `\n\nCreated By Faris Suka Mie Ayam🔥🚀`;

            // Proses Pengiriman Media
            try {
                if (result.type === 'video' && result.videos?.length > 0) {
                    await sock.sendMessage(chatId, { 
                        album: result.videos.map(vidUrl => ({ video: { url: vidUrl }, caption })),
                        contextInfo: ctxInfo
                    }, { quoted: m });
                } 
                else if (result.type === 'photo' && result.images?.length > 0) {
                    await sock.sendMessage(chatId, { 
                        album: result.images.map(imgUrl => ({ image: { url: imgUrl }, caption })),
                        contextInfo: ctxInfo
                    }, { quoted: m });
                } 
                else {
                    // Untuk Carousel (campuran foto dan video)
                    if (result.videos && result.videos.length > 0) {
                        await sock.sendMessage(chatId, { 
                            album: result.videos.map(vidUrl => ({ video: { url: vidUrl }, caption })),
                            contextInfo: ctxInfo
                        }, { quoted: m });
                    }
                    if (result.images && result.images.length > 0) {
                        await sock.sendMessage(chatId, { 
                            album: result.images.map(imgUrl => ({ image: { url: imgUrl }, caption })),
                            contextInfo: ctxInfo
                        }, { quoted: m });
                    }
                }
            } catch (albumError) {
                console.log("Fitur album gagal, mengirim media satu per satu...");
                
                // Fallback jika fitur album tidak disupport Baileys
                if (result.videos && result.videos.length > 0) {
                    for (let vidUrl of result.videos) {
                        await sock.sendMessage(chatId, { video: { url: vidUrl }, caption, contextInfo: ctxInfo }, { quoted: m });
                    }
                }
                if (result.images && result.images.length > 0) {
                    for (let imgUrl of result.images) {
                        await sock.sendMessage(chatId, { image: { url: imgUrl }, caption, contextInfo: ctxInfo }, { quoted: m });
                    }
                }
            }

            // Memberikan reaction ✅ jika sukses
            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            console.error(err);
            await sock.sendMessage(chatId, { 
                text: `❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴜɴᴅᴜʜ*\n\n> ${err.message}` 
            }, { quoted: m });
        }
    }
};
