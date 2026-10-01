<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <img src="assets/logo-light.svg" alt="yoinks" width="288">
</picture>

**her videoyu yoink'le. yapıştır. yoink'le. bitti.**

YouTube, X/Twitter, Instagram, Threads, TikTok ve 1.800'den fazla siteden
video indir — ister terminalden, ister native bir Windows uygulaması olarak.
Bir link yapıştır, çözünürlük seç (ya da sadece mp3), bitti. Popup yok, sahte
indirme butonu yok, şüpheli yönlendirme yok.

---

## Çalıştırmanın iki yolu

| | Terminal (CLI) | Windows uygulaması |
|---|---|---|
| **Kimin için** | hızlı işler, script'ler, sunucular | tıkla-kullan masaüstü |
| **Kurulum** | `npm i -g yoinks` | [Releases](../../releases) sayfası |
| **Gereksinim** | Node 18+ | hiçbir şey (ffmpeg gömülü) |

İkisi de aynı indirme motorunu ve aynı görünümü paylaşır: link yapıştır, format
seç, bitti.

---

## Windows masaüstü uygulaması

Terminal aracıyla aynı akışa sahip native bir Electron uygulaması — terminal
gerekmez.

- **Kurulum dosyası:** `yoinks-<sürüm>-x64-setup.exe` (başlat menüsü + masaüstü kısayolu)
- **Taşınabilir:** `yoinks-<sürüm>-x64-portable.exe` (tek dosya, kurulum gerekmez)

İkisinden birini [Releases](../../releases) sayfasından indir. Bir link yapıştır
(ya da pencereye sürükle), format seç, bitti.

- ffmpeg gömülü gelir; yt-dlp ilk çalıştırmada `%USERPROFILE%\.yoinks\bin`
  klasörüne indirilir ve otomatik güncel tutulur (günde en fazla bir kez)
- Açılışta panodaki link önerilir — almak için `⇥` tuşuna bas
- `↑` önceki linkleri hatırlar, `^t` auto / açık / koyu tema arasında geçiş yapar
- Dosyaların nereye gideceğini durum çubuğundan seç (varsayılan `Downloads`)
- Görev çubuğunda ilerleme, bitince "aç" ve "klasörde göster"
- `yoinks.exe <url>` doğrudan format seçiciye atlar

> Exe'ler henüz kod imzalı değil, bu yüzden ilk çalıştırmada Windows SmartScreen
> uyarabilir — **More info → Run anyway** ile geç.

### Windows uygulamasını derlemek

```sh
npm install
npm run desktop      # geliştirme modunda derle ve çalıştır
npm run dist:win     # → release/*-setup.exe ve *-portable.exe
```

`build/` içindeki ikon `npm run icon` ile üretilir.

---

## Kurulum (terminal)

```sh
npm install -g yoinks
```

Ya da hiçbir şey kurmadan denemek için:

```sh
npx yoinks
```

Node 18+ gerekir. Geri kalan her şey (yt-dlp, ffmpeg) otomatik olarak indirilir
veya pakete dahil gelir.

## Kullanım

```sh
$ yoinks https://youtu.be/dQw4w9WgXcQ    # doğrudan format seçiciye
$ yoinks                                 # url sorar
$ yoinks --theme light                   # açık temayı zorla
```

yoinks terminali devralır (tam ekran, ortalanmış — ve çıkışta kaydırma
geçmişini geri yükler). Formatı ↑/↓ (veya j/k, ya da sayı tuşları) ile seç ve
enter'a bas. `esc` geri gider, `^c` çıkar. Ya da fareyi kullan — yoink butonu,
format listesi ve alt bilgi ipuçları tıklanabilir; logoya tıklamak seni başa
döndürür. Dosyalar `~/Downloads` klasörüne kaydedilir ve iş bitince dosya yolu
terminaline yazdırılır.

### Temalar

Varsayılan `auto` teması terminalinin kendi ön plan ve arka planını kullanır,
yani açık/koyu terminal temalarını tahmin etmeden takip eder. Oturum boyunca
`auto`, `light` ve `dark` arasında geçiş yapmak için `^t` tuşuna bas ya da alt
bilgideki tema kontrolüne tıkla. Tek bir çalıştırma için başlangıç temasını
seçmek üzere `--theme auto`, `--theme light` veya `--theme dark` kullan.

<img src="assets/download-options.png" alt="yoinks format seçici — tahmini dosya boyutlu çözünürlükler ve sadece ses (mp3)" width="100%">

## Nasıl çalışır

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) ile çalışır. İlk çalıştırmada yoinks
  bağımsız yt-dlp binary'sini `~/.yoinks/bin` klasörüne indirir — Python
  gerekmez. Zaten yt-dlp kuruluysa seninkini kullanır.
- ffmpeg (yüksek çözünürlüklü akışları birleştirmek ve mp3 çıkarmak için
  gerekir) önce PATH'te aranır, yedek olarak `ffmpeg-static` kullanılır.
- Terminal arayüzü [Ink](https://github.com/vadimdemedes/ink) — terminal için
  React. Masaüstü uygulaması Electron + React.

## Geliştirme

```sh
npm install
npm run build        # tsup ile dist/ içine bundle et
npm run dev          # değişiklikte yeniden derle
node dist/cli.js <url>
npm run typecheck    # tsc --noEmit
npm test             # birim testleri
```

Yayınlamadan global komut olarak denemek için: `npm link`, sonra herhangi bir
yerde `yoinks` çalıştır.

## Yol haritası

- [ ] Seçiciyi atlayan `--best` / `--mp3` bayrakları (script modu)
- [ ] Çıktı klasörünü seçmek için `-o <dizin>`
- [ ] Oynatma listesi / çoklu video destekli gönderi desteği
- [x] Pano algılama: boş başlat ve kopyaladığın url'yi otomatik öner
- [x] Gömülü yt-dlp binary'si için otomatik güncelleme (`yt-dlp -U`)
- [x] npm'e yayınla (`npm i -g yoinks` / `npx yoinks`)
- [ ] `curl yoinks.sh | sh` kurulum script'i

## Adil kullanım notu

yoinks bir kişisel arşivleme aracıdır. İçerik indirmek bir platformun kullanım
koşullarını ihlal edebilir — yalnızca saklama hakkına sahip olduğun içerikleri
indir ve içerik üreticilerine karşı nazik ol.

## Lisans

[MIT](LICENSE)
