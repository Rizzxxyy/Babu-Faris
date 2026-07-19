# 🤖 Babu faris

Bot WhatsApp multifungsi yang dirancang untuk kecepatan dan stabilitas tinggi. Berjalan di VPS Ubuntu, bot ini menggunakan kombinasi *tool* terbaik untuk menangani pengunduhan media berat dan pengambilan data (*scraping*) dari website secara *real-time*.

---

## 🚀 Teknologi Utama (Core Engine)

* **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: Mesin tangguh di balik fitur *Downloader*. Berbasis Python, *tool* ini mampu menembus perlindungan server untuk mengunduh media dengan kualitas tertinggi (seperti audio FLAC, video YouTube resolusi tinggi, Instagram, dan TikTok).
* **[Axios](https://axios-http.com/)**: HTTP Client super cepat berbasis Node.js. Digunakan sebagai "mesin pengeruk" (*Scraper*) untuk mengambil data mentah dari website web manga, anime, dan API eksternal tanpa *delay*.
* **Cek Ping & Latensi**: Dilengkapi sistem pemantauan internal untuk mengukur kecepatan respon bot terhadap server WhatsApp dalam hitungan milidetik (ms).

---

## 📋 Daftar Fitur

**⚙️ System & Server**
* `.ping` : Mengecek kecepatan respon (latensi) bot. Pastikan bot kamu tidak *delay*!
* `.neofetch` : Menampilkan spesifikasi sistem VPS/Server (RAM, OS, Uptime).
* `.setpp` : Mengganti foto profil bot langsung via chat.

**📥 Downloader (Powered by yt-dlp)**
* `.ig` / `.ig2` <link> : Unduh Video/Reel/Post Instagram.
* `.tt` <link> : Unduh video TikTok tanpa *watermark*.
* `.mf` <link> : Unduh file langsung dari MediaFire.
* `.mp3` <link> : Konversi video YouTube ke audio MP3.
* `.flac` <judul> : Unduh lagu kualitas studio (*High-Resolution Audio*).

**⛩️ Anime & Manga Scraper (Powered by Axios)**
* `.komiku` <judul> : Cari dan baca manga bahasa Indonesia.
* `.animexin` <judul> : Pantau update anime terbaru.
* `.kusonime` <judul> : Ambil link *download* anime *batch*.
* `.mal` <judul> : Cari informasi detail dari database MyAnimeList.

**🎨 Media & Tools**
* `.sticker` : Ubah gambar/video pendek menjadi stiker WA.
* `.brat` <teks> : Buat stiker teks dengan gaya "Brat".
* `.upscale` : Perjernih foto buram menjadi HD.
* `.removebg` : Hapus *background* foto secara instan.

---

## 🛠️ Instruksi Instalasi Lengkap (Termux/Ubuntu/Debian VPS)

Ikuti langkah-langkah di bawah ini untuk menjalankan BOT ACUMALAKA di server kamu.

1. Install Paket Dasar OS
Bot membutuhkan FFmpeg (untuk merender stiker) dan Python (untuk menjalankan yt-dlp). Buka terminal VPS dan jalankan:
```bash
apt update && apt upgrade -y
apt install git ffmpeg python3 python3-pip nodejs npm -y

```
2. Install yt-dlp (Wajib untuk Downloader)
Pasang yt-dlp secara global di VPS kamu menggunakan pip Python:
```
pip3 install -U yt-dlp

```
4. Clone Repository dari GitHub
Tarik kode bot kamu ke dalam VPS:
```
git clone https://github.com/Farisxx7/Bot-Acumalaka-.git
cd Bot-Acumalaka-
```
5. Install Module Node.js (Axios, Baileys, dll)
Install semua *library* pendukung yang dibutuhkan agar bot bisa melakukan *scraping* dan terhubung ke WhatsApp. Jalankan perintah ini di terminal:
```bash
npm install axios cheerio form-data @whiskeysockets/baileys pino qrcode-terminal


```
6. Install Bot nya
```
npm install

```
7. Cara Menjalankan Bot
Mulai hidupkan bot dengan perintah:
```
npm start
```
(Catatan: Setelah jalan, segera cek latensi bot dengan mengirimkan perintah .ping di WhatsApp untuk memastikan koneksi VPS ke server WA stabil).
Created By Faris Suka Mie Ayam🔥🚀
