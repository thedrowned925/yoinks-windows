// Merkezi Türkçe arayüz metinleri.
// react'siz tutuldu ki hem terminal (Ink) hem Electron ana süreci
// (main.cjs) ve renderer'ı aynı dizeleri paylaşabilsin.

/** Marka adı — çevrilmez. */
export const BRAND = 'yoinks'
/** Marka eylemi (buton/ipucu) — çevrilmez. */
export const ACTION = 'yoink'

export const t = {
  tagline: "her videoyu yoink'le. yapıştır. yoink'le. bitti.",
  sites: 'youtube · x · instagram · threads · tiktok · +1800 site daha',

  // ── giriş ──────────────────────────────────────────────
  pasteLink: 'Link yapıştır',
  badLink: "bu bir link'e benzemiyor — tam bir url yapıştır",
  clipboardOffer: 'link panonda — yapıştırmak için ⇥',
  clipboardAccepted: "panondan geldi — yoink'lemek için ↵",
  dropIt: "bırak — yoink'leyelim",
  dragHint: 'ya da bu pencereye bir link sürükle',
  dropLink: 'bir link bırak — dosya ve metin burada çalışmaz',

  // ── hazırlık ───────────────────────────────────────────
  warmingUp: 'hazırlanıyor…',
  fetchingInfo: 'video bilgisi alınıyor…',
  firstRun: 'ilk çalıştırma: yt-dlp indiriliyor…',

  // ── indirme ────────────────────────────────────────────
  download: 'İndir',
  processing: 'işleniyor…',
  downloading: 'indiriliyor…',
  startingDownload: 'indirme başlıyor…',
  linkExpired: 'link süresi doldu — yeni bir tane alınıyor…',
  left: 'kaldı',
  partLabel: (part: number, total: number) => `parça ${part}/${total}  `,
  bestAvailable: 'en iyisi · mp4',
  audioOnly: 'sadece ses · mp3',

  // ── bitti / hata ───────────────────────────────────────
  done: "✓ yoink'lendi!",
  findFile: 'dosyan burada:',
  open: '▶ aç',
  showInFolder: '⌂ klasörde göster',
  yoinkAnother: '↵ bir tane daha',
  tryAgain: '↵ tekrar dene',
  somethingWentWrong: 'Bir şeyler ters gitti.',
  downloadFailedGeneric: 'İndirme başarısız.',

  // ── ipuçları ───────────────────────────────────────────
  hintQuit: 'çık',
  hintCancel: 'iptal',
  hintChoose: 'seç',
  hintBack: 'geri',
  hintHistory: 'geçmiş',
  startOver: 'baştan başla',
  themeLabel: (mode: string) => `tema:${mode}`,

  // ── masaüstü durum çubuğu ──────────────────────────────
  savingTo: 'kayıt yeri',
  change: 'değiştir',
  openFolder: 'klasörü aç',
  changeFolderTitle: 'İndirme klasörünü değiştir',
  openFolderTitle: 'İndirme klasörünü aç',
  backToStart: 'başa dön',
  videoLink: 'Video linki',
  formats: 'Formatlar',

  // ── ana süreç ──────────────────────────────────────────
  nothingToDownload: 'İndirilecek bir şey yok — önce bir link yapıştır.',
  saveDialogTitle: 'İndirilenleri şuraya kaydet…',

  // ── platformlar ────────────────────────────────────────
  unknownSite: 'Bilinmeyen site',

  // ── yt-dlp hataları ────────────────────────────────────
  ytdlpDownloadFailed: (status: number) =>
    `yt-dlp indirilemedi (${status}). Bağlantını kontrol edip tekrar dene.`,
  videoInfoParse: 'yt-dlp video bilgisi ayrıştırılamadı.',
  ytdlpExit: (code: number) => `yt-dlp ${code} koduyla çıktı`,
  downloadCancelled: 'İndirme iptal edildi.',
  downloadFailed: (code: number) => `İndirme başarısız (yt-dlp çıkış kodu ${code}).`,

  // ── argüman hataları ───────────────────────────────────
  themeNeedsValue: '--theme bir değer gerektiriyor: auto, light veya dark',
  unknownTheme: (value: string) => `bilinmeyen tema “${value}” — auto, light veya dark kullan`,
  unknownOption: (arg: string) => `bilinmeyen seçenek “${arg}”`,
  expectedSingleUrl: 'tek bir url bekleniyordu',
}
