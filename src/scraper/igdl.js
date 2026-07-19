import axios from 'axios';
import * as cheerio from 'cheerio';
import vm from 'node:vm';

async function indown(url) {
    try {
        const { data: pageData, headers } = await axios.get('https://indown.io/en1', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(pageData);
        const token = $('input[name="_token"]').val();
        const cookies = headers['set-cookie'] ? headers['set-cookie'].map(v => v.split(';')[0]).join('; ') : '';

        if (!token) throw new Error('Token Indown not found');

        const params = new URLSearchParams();
        params.append('referer', 'https://indown.io/en1');
        params.append('locale', 'en');
        params.append('_token', token);
        params.append('link', url);
        params.append('p', 'i');

        const { data: resultData } = await axios.post('https://indown.io/download', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });

        const $result = cheerio.load(resultData);
        const resultUrls = [];

        $result('video source[src], a[href].btn-outline-primary').each((i, e) => {
            let link = $result(e).attr('src') || $result(e).attr('href');
            if (link) {
                if (link.includes('indown.io/fetch')) {
                    try { link = decodeURIComponent(new URL(link).searchParams.get('url')); } catch (err) {}
                }
                if (/cdninstagram\.com|fbcdn\.net/.test(link)) {
                    resultUrls.push(link.replace(/&dl=1$/, ''));
                }
            }
        });

        const uniqueUrls = [...new Set(resultUrls)];
        if (uniqueUrls.length === 0) throw new Error('No media found');

        return {
            status: true,
            source: 'indown',
            result: {
                metadata: { username: '-', caption: '' },
                downloadUrl: uniqueUrls
            }
        };

    } catch (e) {
        return { status: false, message: e.message };
    }
}

async function snapsave(targetUrl) {
    try {
        const form = new URLSearchParams();
        form.append('url', targetUrl);

        const { data } = await axios.post('https://snapsave.app/id/action.php?lang=id', form, {
            headers: {
                'origin': 'https://snapsave.app',
                'referer': 'https://snapsave.app/id/download-video-instagram',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const ctx = {
            window: {},
            document: { getElementById: () => ({ value: '' }) },
            console: console,
            eval: (res) => res
        };

        vm.createContext(ctx);
        const decoded = vm.runInContext(data, ctx);
        const regex = /https:\/\/d\.rapidcdn\.app\/v2\?[^"]+/g;
        const matches = decoded.match(regex);

        if (matches && matches.length > 0) {
            const cleanUrls = [...new Set(matches.map(url => url.replace(/&amp;/g, '&')))];
            return {
                status: true,
                source: 'snapsave',
                result: {
                    metadata: { username: '-', caption: '' },
                    downloadUrl: cleanUrls
                }
            };
        }

        throw new Error('No media found');
    } catch (e) {
        return { status: false, message: e.message };
    }
}

// Fungsi utama yang di-export ke handler
export async function scrapeIG(url) {
    console.log(`[IG Downloader] Memproses via Indown...`);
    let res = await indown(url);
    
    if (!res.status || !res.result || res.result.downloadUrl.length === 0) {
        console.log(`[IG Downloader] Indown gagal, mencoba Snapsave...`);
        res = await snapsave(url);
    }

    // Jika keduanya gagal
    if (!res.status) {
        console.log(`[IG Downloader Error]: Keduanya gagal mengambil data.`);
        return { type: 'unknown', videos: [], images: [], caption: '', username: '' };
    }

    // Mengubah format array downloadUrl menjadi object yang dikenali oleh ig.js
    let videos = [];
    let images = [];
    
    for (const link of res.result.downloadUrl) {
        if (link.includes('.mp4') || link.includes('video')) {
            videos.push(link);
        } else {
            images.push(link);
        }
    }

    let type = 'unknown';
    if (videos.length && images.length) type = 'carousel';
    else if (videos.length) type = 'video';
    else if (images.length) type = 'photo';

    console.log(`[IG Downloader] Sukses via ${res.source.toUpperCase()}! Tipe: ${type}`);

    return {
        type,
        username: res.result.metadata?.username || 'Instagram',
        caption: res.result.metadata?.caption || '',
        videos,
        images
    };
}
