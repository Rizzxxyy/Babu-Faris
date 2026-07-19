import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { handler } from './handler.js';

// --- PENGATURAN WARNA TERMINAL ---
const color = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m"
};

const logger = pino({ level: 'silent' });

async function startBot() {
    console.log(`${color.cyan}=========================================${color.reset}`);
    console.log(`${color.magenta}🚀 MEMULAI SISTEM BOT ACUMALAKA...${color.reset}`);
    console.log(`${color.cyan}=========================================${color.reset}\n`);

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`${color.blue}ℹ️  Versi WhatsApp: v${version.join('.')} (Terbaru: ${isLatest})${color.reset}`);

    const { state, saveCreds } = await useMultiFileAuthState('session_auth');
    
    const sock = makeWASocket({
        version,
        logger, 
        printQRInTerminal: false,
        auth: state,
        browser: ["FarisBot", "Safari", "3.0"], 
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000, 
        keepAliveIntervalMs: 10000, 
        emitOwnEvents: true,
        retryRequestDelayMs: 2000,
        syncFullHistory: false 
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(`\n${color.yellow}📱 SILAKAN SCAN QR CODE DI BAWAH INI:${color.reset}`);
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`\n${color.red}⚠️  Koneksi Terputus! (Kode: ${reason || 'Tidak diketahui'})${color.reset}`);

            if (reason === DisconnectReason.loggedOut) {
                console.log(`${color.red}❌  Sesi kedaluwarsa. Silakan hapus folder 'session_auth' dan scan ulang.${color.reset}`);
            } else {
                console.log(`${color.yellow}🔄  Mencoba menyambungkan kembali...${color.reset}`);
                startBot();
            }
        } else if (connection === 'open') {
            console.log(`\n${color.green}✅  BOT BERHASIL TERHUBUNG & SIAP DIGUNAKAN!${color.reset}\n`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            const msg = messages[0];
            
            // Log sederhana saat ada pesan masuk
            const sender = msg.key.remoteJid.split('@')[0];
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            const chatType = isGroup ? 'Grup' : 'Pribadi';
            
            console.log(`${color.cyan}📩 [Pesan Baru] ${color.yellow}Dari: ${sender} ${color.blue}(${chatType})${color.reset}`);

            try {
                await handler(sock, msg);
            } catch (err) {
                console.error(`${color.red}⚠️  Error di handler: ${err.message}${color.reset}`);
            }
        }
    });
}

startBot();

process.on('uncaughtException', function (err) {
    console.error(`${color.red}💥 Error Kritis (Uncaught): ${err.message}${color.reset}`);
});

process.on('unhandledRejection', function (err) {
    console.error(`${color.red}💥 Error Kritis (Unhandled): ${err.message}${color.reset}`);
});
