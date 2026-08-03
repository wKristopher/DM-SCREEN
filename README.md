# Kâhin — DM Screen

Masaya kurulan, tarayıcıda çalışan bir D&D 5e Dungeon Master ekranı. Sunucu yok,
hesap yok, abonelik yok — her şey senin tarayıcında durur.

İki fikri var:

1. **Masada beklemek yok.** Aradığın kural, zar veya yaratık en fazla bir tuş uzakta.
2. **Kaynak senin.** Resmî (açık lisanslı) içerik, üçüncü parti kitaplar ve kendi
   yazdığın homebrew aynı aramada, yan yana çıkar.

---

## Ne var içinde

| Bölüm | Ne yapar |
|---|---|
| **Ekran** | Durumlar, savaş aksiyonları, DC/siper/görüş/yolculuk/ölüm tabloları. Tamamen çevrimdışı. |
| **Savaş** | İnisiyatif takibi, HP/temp HP, durumlar (turlu), concentration, death save, toplu yaratık ekleme. |
| **Derleme** | 3.200+ yaratık, 1.400+ büyü, sihirli eşyalar — üstüne senin homebrew'un. |
| **Kâhin** | Tarayıcıda çalışan üretici: NPC, meyhane, yerleşim, zindan, tuzak, hazine, hava, karşılaşma, evet/hayır kâhini. |
| **Ocak** | Kendi yaratık/büyü/eşya/tablo/NPC'lerini yaz, JSON olarak dışa/içe aktar. |
| **Kampanya** | Grup listesi (passive skorlar dahil), seans notları, günlük, ayarlar. |

Her yerde çalışan bir **komut çubuğu** var (`/` ile odaklanır). Ne yazarsan ona göre
davranır:

```
4d6kh3            → zar atar
adv +5            → 2d20kh1+5
goblin            → derlemede arar
npc               → NPC üretir
karşılaşma orman seviye 5   → karşılaşma iskeleti kurar
hazine cr 8       → CR'a göre ganimet
Tuzak var mı?     → evet/hayır kâhini
```

`Alt+1…6` sekmeler arasında gezer.

---

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
```

Diğer komutlar:

```bash
npm run build      # dist/ üretir — herhangi bir statik hosta atılabilir
npm run test       # 145 test: zar, niyet yönlendirici, şema, sağlayıcılar
npm run check      # typecheck + test + build
```

Tamamen statik bir site: `dist/` klasörünü Vercel, Netlify, GitHub Pages ya da
kendi sunucuna koyabilirsin. Backend gerekmez.

---

## Veri kaynakları — canlı

Arama her tuş vuruşunda **ağdan** yapılır; "bir kere indir, kayıttan oku" adımı
yok. İki kaynak paralel yarıştırılır ve sonuçlar geldikçe akar:

| Kaynak | Kapsam | Sıcak bağlantı |
|---|---|---|
| [dnd5eapi.co](https://www.dnd5eapi.co) | SRD 5.1 (~330 yaratık, ~320 büyü) | **~65ms** |
| [Open5e](https://open5e.com) | 3.200+ yaratık, 1.400+ büyü, 17 kitap | ~500ms |

Yani hızlı kaynak neredeyse anında boyanır, geniş katalog arkadan doldurur.
Derleme başlığındaki rozetler her kaynağın gerçek ms değerini gösterir.

**Gecikme nereden geliyor:** ölçümde TLS el sıkışması maliyetin ~%90'ı çıktı
(dnd5eapi soğuk 684ms → sıcak 65ms; Open5e 1012ms → ~500ms). Bu yüzden:

- `<link rel="preconnect">` ile iki bağlantı da sayfa açılırken kurulur
- açılışta minik bir istekle HTTP/2 oturumu tam ısıtılır
- yalnızca CORS-güvenli başlık gönderilir → `OPTIONS` ön-uçuşu hiç olmaz
- aynı sorgu uçuştayken paylaşılır, eskiyen istek iptal edilir
- fareyi bir satırın üstüne getirince statblock önceden çekilir

Açık lisanslı içerik: **SRD 5.1** (OGL 1.0a), **Kobold Press** (Tome of Beasts 1–3,
Creature Codex, Deep Magic, Vault of Magic), **Level Up: A5e** (CC-BY-4.0),
**Black Flag SRD** (ORC), **Critical Role: Tal'Dorei**. Hangi kitapların
taranacağını Derleme → Kaynaklar'dan seçebilirsin.

### Neden 5e.tools değil

Denendi ve ölçüldü — tarayıcıdan teknik olarak mümkün değil:

- Her veri yoluna Cloudflare bot doğrulaması dönüyor (`cf-mitigated: challenge`,
  HTTP 403). JSON değil, doğrulama sayfası geliyor.
- Hiç `access-control-allow-origin` başlığı yok, üstüne
  `cross-origin-embedder-policy: require-corp` — yani tarayıcı yanıtı okumayı
  zaten engeller.

Aşmanın tek yolu, bot korumasını kandıran sunucu tarafı bir vekil yazmak olurdu;
bu hem araya bir sıçrama daha ekleyip **gecikmeyi artırır** hem de telifli
içeriği yeniden dağıtmak olur. Sahip olduğun kitapların içeriğini Ocak
sekmesinden kendi derlemene girebilirsin.

**Çevrimdışı:** görülen yanıtlar `localStorage`'a yedeklenir; bu kayıt yalnızca
internet gittiğinde devreye girer. Ekran sekmesi ve Kâhin zaten hiç ağ kullanmaz.

---

## Homebrew

Ocak sekmesi tam bir içerik editörüdür:

- **Yaratık** — tüm statblock alanları, aksiyonlar/reaksiyonlar/legendary, canlı önizleme
- **Büyü / Eşya** — resmî kayıtlarla aynı şemada
- **Tablo** — kendi rastgele tablolarını yaz. Bir üreticiye *bağlarsan* (`NPC · tavır`
  gibi) Kâhin senin satırlarını da çeker; `Bağımsız` bırakırsan komut çubuğundan
  adıyla çağırabileceğin bir zar tablosu olur.
- **NPC** — tekrar kullanacağın karakterler

Derlemeler `.brew.json` olarak dışa aktarılır ve dosyadan ya da URL'den içe
aktarılır — arkadaşınla paylaşman için.

---

## İsteğe bağlı: yapay zekâ

Kâhin'in tamamı **anahtar gerektirmeden** çalışır. İstersen Kampanya →
Ayarlar'dan bir sağlayıcı bağlayıp serbest metin de aldırabilirsin: betimleme,
NPC replikleri, seans özeti.

| Sağlayıcı | Modeller |
|---|---|
| **Claude** | Opus 5, Sonnet 5, Haiku 4.5 |
| **ChatGPT** | GPT-5.6 Sol / Terra / Luna |
| **Gemini** | 3.6 Flash, 3.5 Flash-Lite |
| **OpenAI uyumlu** | OpenRouter, Groq, Together, LM Studio, Ollama… (adres + model kendin girersin) |

Her sağlayıcının anahtarı ayrı tutulur, aralarında geçiş yapınca kaybolmaz.
"Bağlantıyı dene" düğmesi tek küçük istekle anahtarı ve gecikmeyi doğrular.

Anahtar yalnızca senin tarayıcında saklanır ve doğrudan sağlayıcıya gider —
arada sunucu yok. Üçünün de tarayıcıdan doğrudan çağrıya izin verdiği CORS
ön-uçuşu ile teyit edildi; bu yüzden üç ayrı SDK yerine tek ince `fetch`
katmanı var (paket ~167KB daha küçük).

> OpenAI hata yanıtlarında CORS başlığı göndermiyor, bu yüzden geçersiz anahtar
> tarayıcıya opak bir ağ hatası olarak düşüyor. Uygulama bu durumu tanıyıp
> "büyük ihtimalle anahtar geçersiz" diye söylüyor.

---

## Teknik notlar

- React 19 + TypeScript + Vite, durum yönetimi Zustand (`persist` ile localStorage)
- Tailwind v4, tema tokenları CSS değişkenlerinde — `dusk` (karanlık) ve
  `parchment` (aydınlık)
- Dış font/ikon/görsel yok: ikonlar satır içi SVG, doku SVG filtresi
- Zar motoru `kh/kl/dh/dl`, `r/ro`, `!`, `min/max`, parantez ve karma terimleri
  destekler; zarlar `crypto.getRandomValues` ile ret örneklemesi kullanır
- Dış SDK yok: üç LLM sağlayıcısı da tek SSE çözümleyicisiyle ham `fetch`
  üzerinden konuşur

```
src/
  lib/
    dice.ts        zar ifadesi çözümleyici
    open5e.ts      Open5e istemcisi + çevrimdışı yedek
    dnd5eapi.ts    hızlı SRD aynası (şema normalizasyonu)
    live.ts        kaynak yarıştırma, ölçüm, ısıtma
    srd.ts         çevrimdışı başvuru tabloları
    homebrew.ts    derleme şeması, içe/dışa aktarma
    ai/
      tables.ts    üretici veri bankaları
      generators.ts üreticiler
      oracle.ts    komut çubuğu niyet yönlendirici
      providers.ts Claude / ChatGPT / Gemini / uyumlu köprü
      llm.ts       istem katmanı
  store/           zustand store'ları
  components/      paneller
```

## Lisans

Kod MIT. Oyun içeriği ilgili açık lisansları altındadır (OGL 1.0a / CC-BY-4.0 / ORC).
