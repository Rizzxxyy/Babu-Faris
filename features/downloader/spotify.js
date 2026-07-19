/**
 * Created By Faris Suka Mie Ayam🔥🚀
 */

import * as cheerio from 'cheerio';
import { unlink, writeFile } from "fs/promises";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

// Penulisan bypassCF.js sudah disesuaikan dengan nama file di server
import { turnstileBypass } from '#utils/bypassCF.js';
import Func from '#utils/funcc.js';

const TMP_DIR = './tmp'; 
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

export async function spSearch(query) {
  try {
    const res = await fetch(
      `https://sportify.xcasper.space/api/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
    const json = await res.json();
    const results = json.results.map(track => ({
       title: track.title,
       artist: track.artists.map(a => a).join(', '),
       duration: track.duration,
       imageUrl: track.thumbnail,
       trackUrl: track.url
    }));
    return { success: true, results };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function spDownrize(spotifyUrl) {
    try {
        const tokens = await getDownloaderizeToken();
        if (!tokens) throw new Error("Gagal mengambil token keamanan.");

        const bodyParams = new URLSearchParams({
            action: 'spotify_downloader_get_info',
            url: spotifyUrl,
            nonce: tokens.downloadNonce
        });

        const response = await fetch("https://spotify.downloaderize.com/wp-admin/admin-ajax.php", {
            method: 'POST',
            body: bodyParams.toString()
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const json = await response.json();

        if (!json.success || !json.data) {
            throw new Error('Gagal mengekstrak data dari Downloaderize (Mungkin Nonce Expired).');
        }

        const trackData = json.data;
        const audioUrl = json.data.medias[0]?.url;
        if (!audioUrl) throw new Error("Link audio tidak tersedia.");
        const audioBuffer = await Func.getBuffer(audioUrl);
        if (!audioBuffer.toString()) throw new Error("sp downrize mengembalikan buffer kosong.");

        return {
            success: true,
            title: trackData.title,
            artist: trackData.author,
            thumbnail: trackData.thumbnail,
            audioBuffer,
            isFlac: false,
            sourceUrl: trackData.url || spotifyUrl
        };

    } catch (error) {
        return { success: false, message: error.message };
    }
}

const FLAC_CONFIG = {
    BASE_URL: "https://api.spotidownloader.com",
    SITE_KEY: "0x4AAAAAAA8QAiFfE5GuBRRS",
    HEADERS: {
        'User-Agent': 'ScRaPe/9.9 (KaliLinux; Nusantara Os; My/Shannz)',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'sec-ch-ua-platform': '"Android"',
        'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'sec-ch-ua-mobile': '?1',
        'origin': 'https://spotidownloader.com',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://spotidownloader.com/',
        'accept-language': 'id,en-US;q=0.9,en;q=0.8',
        'priority': 'u=1, i'
    }
};

const getTrackId = (url) => {
    const match = url.match(/(?:track|id)\/([a-zA-Z0-9]{22})/);
    return match ? match[1] : url;
};

const spDlder = {
    getSession: async () => {
        try {
            const turnstileToken = await turnstileBypass(
                FLAC_CONFIG.BASE_URL + "/session",
                FLAC_CONFIG.SITE_KEY
            );

            if (!turnstileToken) throw new Error("Gagal generate Turnstile token");

            const response = await fetch(`${FLAC_CONFIG.BASE_URL}/session`, {
                method: 'POST',
                headers: FLAC_CONFIG.HEADERS,
                body: JSON.stringify({ token: turnstileToken })
            });

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const data = await response.json();
            return data.token;
        } catch (error) {
            return null;
        }
    },
    
    download: async (urlOrId) => {
        try {
            const trackId = getTrackId(urlOrId);
            const token = await spDlder.getSession();
            
            if (!token) {
                return { success: false, message: 'Gagal mendapatkan sesi FLAC.' };
            }

            const authHeaders = {
                ...FLAC_CONFIG.HEADERS,
                'Authorization': `Bearer ${token}`
            };

            const metaRes = await fetch(`${FLAC_CONFIG.BASE_URL}/metadata`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ type: "track", id: trackId })
            });
            const metadata = await metaRes.json();
            
            if (!metadata.success) {
                return { success: false, message: 'Metadata tidak ditemukan di Spotidownloader.' };
            }

            let isFlac = false;
            try {
                const flacRes = await fetch(`${FLAC_CONFIG.BASE_URL}/isFlacAvailable`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ id: trackId })
                });
                const flacData = await flacRes.json();
                isFlac = flacData.flacAvailable === true;
            } catch (e) {}

            let downloadPayload = { id: trackId };
            
            if (isFlac) {
                downloadPayload.flac = true;
                downloadPayload.isFlac = true;
                downloadPayload.format = "flac";
            }

            const downRes = await fetch(`${FLAC_CONFIG.BASE_URL}/download`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(downloadPayload)
            });
            
            if (!downRes.ok) throw new Error(`Gagal mengunduh audio: ${downRes.status}`);
            const downData = await downRes.json();

            const flacLink = downData.linkFlac || downData.flac || downData.url_flac;
            const mp3Link = downData.link || downData.url;
            
            const finalLink = isFlac && flacLink ? flacLink : mp3Link;
            if (!finalLink) throw new Error("Link audio tidak tersedia.");
            const audioBuffer = await Func.getBuffer(finalLink);
            if (!audioBuffer.toString()) throw new Error("spotidl mengembalikan buffer kosong.");

            return {
                success: true,
                title: metadata.title,
                artist: metadata.artists,
                thumbnail: metadata.cover,
                audioBuffer,
                isFlac: !!(isFlac && flacLink),
                sourceUrl: urlOrId
            };

        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

const spotilab = {
    download: async (spotifyUrl) => {
        try {
            const headers = {
                "accept": "*/*",
                "accept-language": "en-US",
                "content-type": "application/json",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Chromium\";v=\"127\", \"Not)A;Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Android\"",
                "Referer": "https://spotilab.com/"
            };

            const convertRes = await fetch("https://spotilab.com/api/convert", {
                method: "POST",
                headers: headers,
                body: JSON.stringify({ url: spotifyUrl, format: "flac", quality: "lossless" })
            });

            if (!convertRes.ok) throw new Error(`Spotilab Convert Error: ${convertRes.status}`);
            const convertData = await convertRes.json();

            if (!convertData.jobId) throw new Error("Spotilab tidak merespon dengan Job ID.");

            let isCompleted = false;
            let finalData = null;
            let attempts = 0;
            const maxAttempts = 15; 

            while (!isCompleted && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 3000)); 

                const statusRes = await fetch(`https://spotilab.com/api/convert/status/${convertData.jobId}`, {
                    headers: headers
                });
                const statusData = await statusRes.json();

                if (statusData.status === 'completed' || statusData.status === 'success' || statusData.downloadUrl) {
                    isCompleted = true;
                    finalData = statusData;
                } else if (statusData.status === 'failed' || statusData.status === 'error') {
                    throw new Error(statusData.message || "Konversi Spotilab dibatalkan oleh server.");
                }
                
                attempts++;
            }

            if (!isCompleted || !finalData) throw new Error("Spotilab Timeout (Terlalu lama dalam antrean).");

            const audioUrl = finalData.downloadUrl || finalData.url || finalData.file; 
            if (!audioUrl) throw new Error("Spotilab tidak memberikan link download yang valid.");

            const audioRes = await fetch(audioUrl);
            const arrayBuffer = await audioRes.arrayBuffer();
            const audioBuffer = Buffer.from(arrayBuffer);

            if (audioBuffer.length < 1000) throw new Error("Spotilab mengembalikan file audio yang rusak/kosong.");

            return {
                success: true,
                title: finalData.metadata?.title || finalData.title || "Unknown Title",
                artist: finalData.metadata?.artist || finalData.artist || "Unknown Artist",
                album: finalData.metadata?.album || finalData.title || "Single",
                thumbnail: finalData.metadata?.cover || finalData.thumbnail || null,
                audioBuffer: audioBuffer,
                isFlac: true,
                sourceUrl: spotifyUrl
            };

        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

const yoinkify = {
    download: async (spotifyUrl) => {
        try {
            const headers = {
                "accept": "*/*",
                "accept-language": "en-US",
                "content-type": "application/json",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Chromium\";v=\"127\", \"Not)A;Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Android\"",
                "Referer": "https://yoinkify.com/app",
            };

            const metaRes = await fetch("https://yoinkify.com/api/metadata", {
                method: "POST",
                headers: headers,
                body: JSON.stringify({ url: spotifyUrl })
            });
            if (!metaRes.ok) throw new Error(`Yoinkify Meta Error: ${metaRes.status}`);
            const metadata = await metaRes.json();

            const downRes = await fetch("https://yoinkify.com/api/download", {
                method: "POST",
                headers: headers,
                body: JSON.stringify({ url: spotifyUrl, format: "flac", genreSource: "spotify", syncedLyrics: false })
            });
            if (!downRes.ok) throw new Error(`Yoinkify Download Error: ${downRes.status}`);
            
            const arrayBuffer = await downRes.arrayBuffer();
            const audioBuffer = Buffer.from(arrayBuffer);

            if (!audioBuffer.toString()) throw new Error("Yoinkify mengembalikan buffer kosong.");

            return {
                success: true,
                title: metadata.name,
                artist: metadata.artist || metadata.albumArtist,
                album: metadata.album,
                thumbnail: metadata.albumArt || "https://i.ibb.co/vxLRS6J/spotify-logo.png",
                audioBuffer,
                isFlac: true,
                sourceUrl: spotifyUrl
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

async function injectMetadata(data) {
    const trackId = Date.now();
    const ext = data.isFlac ? 'flac' : 'mp3';

    const headStr = data.audioBuffer.toString('utf8', 0, 15).toLowerCase();
    if (headStr.includes('<!doctype') || headStr.includes('<html')) {
        throw new Error("Buffer corrupt: API mengembalikan HTML, bukan audio.");
    }

    let isNativeFlac = false;
    let isNativeMp3 = false;
    if (data.audioBuffer.length > 4) {
        const hex = data.audioBuffer.toString('hex', 0, 4);
        if (hex === '664c6143') isNativeFlac = true; 
        if (hex.startsWith('494433') || hex.startsWith('fffb') || hex.startsWith('fffa')) isNativeMp3 = true; 
    }
    
    const tempAudioPath = path.resolve(TMP_DIR, `raw_${trackId}.tmp`);
    const tempCoverPath = path.resolve(TMP_DIR, `cover_${trackId}.jpg`);
    const finalOutputPath = path.resolve(TMP_DIR, `${(data.artist || 'Artist').replace(/[^a-zA-Z0-9]/g, '')}_${trackId}.${ext}`);

    try {
        // [FIX] Menggunakan fungsi fs Node.js bukan Bun
        await writeFile(tempAudioPath, data.audioBuffer);

        let hasCover = false;
        if (data.thumbnail) {
            try {
                const coverBuf = await Func.getBuffer(data.thumbnail);
                if (!coverBuf.toString('utf8', 0, 15).toLowerCase().includes('<!doctype')) {
                    await writeFile(tempCoverPath, coverBuf);
                    hasCover = true;
                }
            } catch (e) {}
        }

        const ffmpegArgs = [
            "-y", "-hide_banner", "-loglevel", "error",
            "-i", tempAudioPath
        ];

        if (hasCover) {
            ffmpegArgs.push("-i", tempCoverPath);
        }

        ffmpegArgs.push("-map", "0:a:0");

        if (hasCover) {
            ffmpegArgs.push("-map", "1:v:0", "-c:v", "mjpeg", "-disposition:v:0", "attached_pic");
        }

        if (data.isFlac) {
            if (isNativeFlac) {
                ffmpegArgs.push("-c:a", "copy");
            } else {
                ffmpegArgs.push("-c:a", "flac");
            }
        } else {
            if (isNativeMp3) {
                ffmpegArgs.push("-c:a", "copy"); 
            } else {
                ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", "320k"); 
            }
            ffmpegArgs.push("-id3v2_version", "3");
        }

        ffmpegArgs.push(
            "-metadata", `title=${data.title || 'Unknown Title'}`,
            "-metadata", `artist=${data.artist || 'Unknown Artist'}`,
            "-metadata", `album=${data.album || data.title || 'Single'}`,
            finalOutputPath
        );

        // [FIX] Menggunakan fungsi spawn Node.js bukan Bun
        await new Promise((resolve, reject) => {
            const proc = spawn("ffmpeg", ffmpegArgs, { stdio: ['ignore', 'ignore', 'inherit'] });
            proc.on('close', (code) => {
                if (code !== 0) reject(new Error(`FFmpeg error (Code: ${code})`));
                else resolve();
            });
            proc.on('error', (err) => reject(err));
        });

        await Promise.all([
            unlink(tempAudioPath).catch(() => {}),
            unlink(tempCoverPath).catch(() => {})
        ]);

        return {
            success: true,
            file_path: finalOutputPath,
            title: data.title,
            artist: data.artist,
            album: data.album,
            thumbnail: data.thumbnail,
            isFlac: data.isFlac
        };

    } catch (err) {
        await unlink(tempAudioPath).catch(() => {});
        await unlink(tempCoverPath).catch(() => {});
        throw new Error(`Gagal Inject Metadata: ${err.message}`);
    }
}

export async function spDownload(url) {
    let rawData = null;

    console.log("[Spotify] Tahap 1: Mencoba Spotilab (FLAC Lossless Priority)...");
    rawData = await spotilab.download(url);

    if (!rawData || !rawData.success || !rawData.audioBuffer) {
        console.log(`[Spotify] Spotilab gagal: ${rawData?.message || 'Tidak ada buffer'}. Fallback Tahap 2: Yoinkify...`);
        rawData = await yoinkify.download(url); 
    }

    if (!rawData || !rawData.success || !rawData.audioBuffer) {
        console.log(`[Spotify] Yoinkify gagal: ${rawData?.message || 'Tidak ada buffer'}. Fallback Tahap 3: spDlder...`);
        rawData = await spDlder.download(url); 
    }

    if (!rawData || !rawData.success || !rawData.audioBuffer) {
        return { success: false, message: "Semua (3) API Downloader sedang bermasalah atau lagu tidak tersedia." };
    }

    try {
        const finalData = await injectMetadata(rawData);
        return finalData;
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ==========================================
// FORMAT HANDLER BARU (Disesuaikan dengan handler.js)
// ==========================================
export default {
    command: ['spotify', 'sp', 'play', 'lagu'],
    // Menyesuaikan parameter dari handler.js milikmu: (sock, m, { args, q, isOwner, sender, realSender })
    execute: async (sock, m, { q, sender }) => {
        if (!q) {
            return sock.sendMessage(sender, { 
                text: `❌ *Format salah!*\n\nKirim perintah beserta judul lagu atau link Spotify.\n\n*Contoh:*\n.spotify Nala - Tulus\n.spotify https://open.spotify.com/...` 
            }, { quoted: m });
        }

        try {
            await sock.sendMessage(sender, { text: '⏳ *Memproses permintaanmu...*' }, { quoted: m });

            let targetUrl = q;
            let trackInfoText = '';

            const isSpotifyLink = q.match(/spotify\.com\/(track|episode|album|playlist)/i);

            if (!isSpotifyLink) {
                const searchData = await spSearch(q);
                
                if (!searchData.success || !searchData.results || searchData.results.length === 0) {
                    return sock.sendMessage(sender, { text: '❌ Lagu tidak ditemukan. Coba masukkan nama artisnya juga.' }, { quoted: m });
                }

                const firstResult = searchData.results[0];
                targetUrl = firstResult.trackUrl;
                trackInfoText = `🔍 *Pencarian:* ${firstResult.title} - ${firstResult.artist}\n⏳ *Sedang mengunduh audio...*`;
                
                await sock.sendMessage(sender, { text: trackInfoText }, { quoted: m });
            }

            const downRes = await spDownload(targetUrl);

            if (!downRes.success) {
                return sock.sendMessage(sender, { text: `❌ *Gagal mengunduh:* ${downRes.message}` }, { quoted: m });
            }

            const mimeType = downRes.isFlac ? 'audio/flac' : 'audio/mpeg';
            const fileName = `${downRes.title} - ${downRes.artist}.${downRes.isFlac ? 'flac' : 'mp3'}`;

            await sock.sendMessage(sender, {
                audio: { url: downRes.file_path },
                mimetype: mimeType,
                ptt: false, 
                fileName: fileName,
                contextInfo: {
                    externalAdReply: {
                        title: downRes.title || 'Unknown Title',
                        body: downRes.artist || 'Unknown Artist',
                        mediaType: 2,
                        thumbnailUrl: downRes.thumbnail || "https://i.ibb.co/vxLRS6J/spotify-logo.png",
                        sourceUrl: targetUrl,
                        renderLargerThumbnail: true 
                    }
                }
            }, { quoted: m });

            await unlink(downRes.file_path).catch((err) => {
                console.error(`[Cleanup Error] Gagal menghapus file:`, err);
            });

        } catch (error) {
            console.error(error);
            sock.sendMessage(sender, { text: `❌ *Terjadi kesalahan sistem:* ${error.message}` }, { quoted: m });
        }
    }
};
