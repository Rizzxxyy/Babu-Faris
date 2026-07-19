import axios from 'axios';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import * as config from '../../config.js';

// ==========================================
// PENGATURAN HEADERS & COOKIE INSTAGRAM
// ==========================================
const getHeaders = () => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'cache-control': 'max-age=0',
    'dpr': '2',
    'viewport-width': '980',
    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-ch-ua-platform-version': '"15.0.0"',
    'sec-ch-ua-model': '"25028RN03A"',
    'sec-ch-ua-full-version-list': '"Chromium";v="136.0.7103.125", "Google Chrome";v="136.0.7103.125", "Not.A/Brand";v="99.0.0.0"',
    'sec-ch-prefers-color-scheme': 'light',
    'dnt': '1',
    'upgrade-insecure-requests': '1',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-user': '?1',
    'sec-fetch-dest': 'document',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'priority': 'u=0, i',
    'Cookie': 'Csrftoken=9Zd2Avg49oL1AFIeDQclB4; datr=6_fHaQ9sUS6XshEiGpHtYEBP; ig_did=F960353F-0D4E-4529-A26E-09F26A27F5FC; ps_l=1; ps_n=1; dpr=1.7000000476837158; mid=acf36wABAAHPJbh3hGsBundCVk9Q; wd=424x851; ds_user_id=38741244537; sessionid=38741244537%3AINdhjrpQUCPHsN%3A7%3AAYjd1BBLVynne0IrE66MDZMyXIuR-UCS9_Kem8ZPUA; rur="CCO\\05438741244537\\0541806249243:01fe5be8cca5dfdf790790343089535cf6e180c2b42a22dc64b9670d00694b9f2c28fd09"'
});

/***
  @ Base: https://www.instagram.com/
  @ Scraper: Shannz (Updated)
***/
const instagram = {
    // ---- BAGIAN REELS (VIDEO) ----
    video: async (url) => {
        if (!url) return { status: false, error: 'URL tidak valid atau kosong.' };
        try {
            const response = await axios.get(url, { headers: getHeaders(), timeout: 10000 });
            const $ = cheerio.load(response.data);
            let item = null;
            
            $('script[type="application/json"]').each((_, el) => {
                const content = $(el).html();
                // Mencari di dua struktur (Foto/Reels)
                if (content && (content.includes('xdt_api__v1__media__shortcode__web_info') || content.includes('xdt_shortcode_media'))) {
                    try { 
                        const scriptJson = JSON.parse(content); 
                        const data = scriptJson.require?.[0]?.[3]?.[0]?.__bbox?.require?.[0]?.[3]?.[1]?.__bbox?.result?.data;
                        if (data) {
                            item = data.xdt_api__v1__media__shortcode__web_info?.items?.[0] || data.xdt_shortcode_media;
                        }
                    } catch (e) {}
                }
            });

            if (!item) throw new Error('Data script tidak ditemukan (Mungkin IP Blocked atau struktur Reels berubah).');
            
            let videoTracks = [];

            // Cek format MP4 langsung (video_versions) terlebih dahulu
            if (item.video_versions && item.video_versions.length > 0) {
                videoTracks = item.video_versions.map(v => ({ url: v.url, bandwidth: v.width * v.height }));
            } 
            // Fallback ke DASH XML
            else if (item.video_dash_manifest) {
                const parser = new XMLParser({ ignoreAttributes: false });
                const manifest = parser.parse(item.video_dash_manifest);
                const period = manifest.MPD?.Period;
                if (period) {
                    const adaptationSets = Array.isArray(period.AdaptationSet) ? period.AdaptationSet : [period.AdaptationSet];
                    adaptationSets.forEach((set) => {
                        if (!set) return;
                        if (set['@_contentType'] === 'video') {
                            const representations = Array.isArray(set.Representation) ? set.Representation : [set.Representation];
                            representations.forEach((rep) => {
                                if (rep && rep.BaseURL) videoTracks.push({ url: rep.BaseURL, bandwidth: parseInt(rep['@_bandwidth']) || 0 });
                            });
                        }
                    });
                }
            }

            if (videoTracks.length === 0) throw new Error('URL Media Video tidak ditemukan di postingan ini.');
            videoTracks.sort((a, b) => b.bandwidth - a.bandwidth);

            return {
                status: true,
                result: {
                    metadata: { caption: item.caption?.text || item.edge_media_to_caption?.edges?.[0]?.node?.text || '' },
                    author: { username: item.user?.username || item.owner?.username || 'N/A', fullName: item.user?.full_name || item.owner?.full_name || '' },
                    media: { videos: videoTracks }
                }
            };
        } catch (error) { return { status: false, error: error.message }; }
    },
    
    // ---- BAGIAN SLIDE (FOTO) ----
    slide: async (url) => {
        if (!url) return { status: false, error: 'URL tidak valid atau kosong.' };
        try {
            const response = await axios.get(url, { headers: getHeaders(), timeout: 10000 });
            const $ = cheerio.load(response.data);
            let scriptJson = null;
            $('script[type="application/json"]').each((_, el) => {
                const content = $(el).html();
                if (content && content.includes('xdt_api__v1__media__shortcode__web_info')) {
                    try { scriptJson = JSON.parse(content); } catch (e) {}
                }
            });
            if (!scriptJson) throw new Error('Data script tidak ditemukan (Mungkin IP Blocked atau URL salah).');
            const item = scriptJson.require?.[0]?.[3]?.[0]?.__bbox?.require?.[0]?.[3]?.[1]?.__bbox?.result?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0];
            if (!item) throw new Error('Struct item tidak ditemukan dalam JSON.');
            
            let slides = [];
            if (item.carousel_media && item.carousel_media.length > 0) {
                slides = item.carousel_media.map((slideItem) => {
                    return {
                        images: (slideItem.image_versions2?.candidates || []).map(img => ({ url: img.url })),
                        videos: slideItem.video_versions ? slideItem.video_versions.map(v => ({ url: v.url })) : []
                    };
                });
            } else if (item.image_versions2 || item.video_versions) {
                // Mendukung postingan slide tunggal (foto tunggal atau video tunggal di link /p/)
                slides.push({
                    images: (item.image_versions2?.candidates || []).map(img => ({ url: img.url })),
                    videos: item.video_versions ? item.video_versions.map(v => ({ url: v.url })) : []
                });
            } else {
                throw new Error('Tidak ada media gambar/slide yang ditemukan pada post ini.');
            }
            return {
                status: true,
                result: {
                    metadata: { caption: item.caption?.text || '' },
                    author: { username: item.user?.username || 'N/A', fullName: item.user?.full_name || '' },
                    media: { slides: slides }
                }
            };
        } catch (error) { return { status: false, error: error.message }; }
    }
};

export default {
    command: ['ig2'],
    execute: async (sock, m, { sender }) => {
        const chatId = m.key.remoteJid;
        const fullText = m.message?.conversation || m.message?.extendedTextMessage?.text || m.text || '';
        const urlMatch = fullText.match(/https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|stories|tv)\/[^\s]+/i);
        const url = urlMatch ? urlMatch[0] : null;

        if (!url) {
            return sock.sendMessage(chatId, { 
                text: `📸 *ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ ᴠ2*\n\n` +
                      `> \`.ig2 <url>\`\n\n` +
                      `*ᴄᴏɴᴛᴏʜ:*\n` +
                      `> \`.ig2 https://www.instagram.com/reel/xxx\`` 
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            let res;
            let isReel = url.includes('/reel/') || url.includes('/tv/');

            if (isReel) {
                res = await instagram.video(url);
            } else {
                res = await instagram.slide(url);
            }

            if (!res.status) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(chatId, { 
                    text: `❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴀᴍʙɪʟ ᴅᴀᴛᴀ*\n\n> ${res.error}` 
                }, { quoted: m });
            }

            const { metadata, author, media } = res.result;

            const captionText = metadata.caption ? `\n\n📝 *Caption:*\n${metadata.caption}` : '';
            
            const caption =
                `✅ *ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ ᴠ2*\n\n` +
                `> 👤 @${author.username}` +
                captionText +
                `\n\nCreated By Faris Suka Mie Ayam🔥🚀`;

            const getBuffer = async (mediaUrl) => {
                const response = await axios.get(mediaUrl, { 
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                return Buffer.from(response.data, 'binary');
            };

            if (isReel) {
                const videoUrl = media.videos[0]?.url;
                if (!videoUrl) throw new Error('Video tidak ditemukan.');
                
                const vidBuffer = await getBuffer(videoUrl);
                // Dihapus contextInfo
                await sock.sendMessage(chatId, { 
                    video: vidBuffer, 
                    caption: caption 
                }, { quoted: m });

            } else {
                const slides = media.slides;
                if (!slides || slides.length === 0) throw new Error('Media tidak ditemukan.');

                for (let i = 0; i < slides.length; i++) {
                    const slide = slides[i];
                    const sendCap = (i === 0) ? caption : ''; 

                    // Dihapus contextInfo
                    if (slide.videos && slide.videos.length > 0) {
                        const vidBuffer = await getBuffer(slide.videos[0].url);
                        await sock.sendMessage(chatId, { video: vidBuffer, caption: sendCap }, { quoted: m });
                    } else if (slide.images && slide.images.length > 0) {
                        const imgBuffer = await getBuffer(slide.images[0].url);
                        await sock.sendMessage(chatId, { image: imgBuffer, caption: sendCap }, { quoted: m });
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            console.error('[ERROR IG2]:', err);
            await sock.sendMessage(chatId, { 
                text: `❌ *ᴛᴇʀᴊᴀᴅɪ ᴋᴇsᴀʟᴀʜᴀɴ sɪsᴛᴇᴍ*\n\n> ${err.message}` 
            }, { quoted: m });
        }
    }
};
