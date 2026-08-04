# Kâhin — DM Screen

Masaya kurulan, tarayıcıda çalışan bir D&D 5e Dungeon Master ekranı. Sunucu yok,
hesap yok, abonelik yok — her şey senin tarayıcında durur.

İki fikri var:

1. **Masada beklemek yok.** Aradığın kural, zar veya yaratık en fazla bir tuş uzakta.
2. **Kaynak senin.** Açık lisanslı içerik, üçüncü parti kitaplar, kendi 5etools
   kopyandan ürettiğin yerel katalog ve kendi yazdığın homebrew — hepsi aynı
   aramada, yan yana çıkar.

---

## Ne var içinde

| Bölüm | Ne yapar |
|---|---|
| **Ekran** | Durumlar, savaş aksiyonları, DC/siper/görüş/yolculuk/ölüm tabloları. Tamamen çevrimdışı. |
| **Savaş** | İnisiyatif takibi, HP/temp HP, durumlar (turlu), concentration, death save, toplu yaratık ekleme. |
| **Derleme** | Yaratık, büyü, eşya ve kural araması. Açık lisanslı ağ kaynakları + (istersen) kendi 5etools kopyandan üretilmiş yerel katalog + senin homebrew'un, hepsi tek listede. |
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
npm run test       # 260 test: zar, niyet yönlendirici, şema, sağlayıcılar, 5etools dönüşümü
npm run check      # typecheck + test + build

# Elindeki 5etools kopyasından yerel katalog üret (isteğe bağlı, aşağıda)
npm run data:5etools -- --src "C:/yol/5etools-src"
```

Tamamen statik bir site: `dist/` klasörünü Vercel, Netlify, GitHub Pages ya da
kendi sunucuna koyabilirsin. Backend gerekmez.

---

## Veri kaynakları

Arama her tuş vuruşunda tüm kaynaklara birden gider; "bir kere indir, kayıttan
oku" adımı yok. Kaynaklar paralel yarıştırılır ve sonuçlar geldikçe akar:

| Kaynak | Kapsam | Süre |
|---|---|---|
| **5etools (yerel)** | 12.000+ kayıt · isteğe bağlı, aşağıya bak | **~2ms** |
| [dnd5eapi.co](https://www.dnd5eapi.co) | SRD 5.1 (~330 yaratık, ~320 büyü) | ~65ms (sıcak) |
| [Open5e](https://open5e.com) | 3.200+ yaratık, 1.400+ büyü, 17 kitap | ~500ms (sıcak) |

Yerel katalog varsa neredeyse anında boyanır, hızlı ağ kaynağı onu takip eder,
geniş katalog arkadan doldurur. Derleme başlığındaki rozetler her kaynağın
gerçek ms değerini gösterir.

**Ağ gecikmesi nereden geliyor:** ölçümde TLS el sıkışması maliyetin ~%90'ı çıktı
(dnd5eapi soğuk 684ms → sıcak 65ms; Open5e 1012ms → ~500ms). Bu yüzden:

- `<link rel="preconnect">` ile iki bağlantı da sayfa açılırken kurulur
- açılışta minik bir istekle HTTP/2 oturumu tam ısıtılır
- yalnızca CORS-güvenli başlık gönderilir → `OPTIONS` ön-uçuşu hiç olmaz
- aynı sorgu uçuştayken paylaşılır, eskiyen istek iptal edilir
- fareyi bir satırın üstüne getirince statblock önceden çekilir

Ağ kaynaklarındaki içerik açık lisanslıdır: **SRD 5.1** (OGL 1.0a),
**Kobold Press** (Tome of Beasts 1–3, Creature Codex, Deep Magic, Vault of
Magic), **Level Up: A5e** (CC-BY-4.0), **Black Flag SRD** (ORC),
**Critical Role: Tal'Dorei**. Hangi kitapların taranacağını Derleme →
Kaynaklar'dan seçebilirsin.

**Çevrimdışı:** görülen ağ yanıtları `localStorage`'a yedeklenir; bu kayıt
yalnızca internet gittiğinde devreye girer. Yerel katalog, Ekran sekmesi ve
Kâhin zaten hiç ağ kullanmaz.

---

## 5etools kataloğu (yerel)

Elinde bir 5etools kaynak kopyası varsa, tek komutla ekranın içine
aktarabilirsin:

```bash
npm run data:5etools -- --src "C:/yol/5etools-src-2.33.3"
```

Çıkan katalog `public/5etools/` altına yazılır; `npm run dev` ve `npm run build`
onu olduğu gibi servis eder. Ölçülen sonuç:

| Tür | Kayıt |
|---|---|
| Yaratık | 4.528 (`_copy` ile türetilenler çözülmüş hâlde) |
| Büyü | 936 (sınıf listeleri geri eklenmiş) |
| Eşya | 6.400 (sihirli varyantlar — "+2 Longsword" — üretilmiş hâlde) |
| Kural | 386 (durum, hastalık, aksiyon, duyu, varyant kural) |

Seçenekler:

```
--src <dizin>     5etools kaynak kökü (data/ ve js/ içeren dizin)
--out <dizin>     Çıktı dizini (varsayılan: public/5etools)
--brew <dizin>    Ek 5etools homebrew klasörü (birden çok kez verilebilir)
--shard <n>       Parça başına kayıt (varsayılan: 120)
--no-ua           Unearthed Arcana / prerelease kaynaklarını dışarıda bırak
```

Derleme → **Kaynaklar**'dan kataloğu açıp kapatabilir, "yalnız yerel" ile ağ
kaynaklarını tamamen devre dışı bırakabilir, kitap kitap filtreleyebilirsin.

**Neden derleme adımı, canlı bağlantı değil:**

- Yaratıkların dörtte biri (4.528'in 1.141'i) başka bir statblock'un *farkı*
  olarak tanımlı; eşyalar temel eşya × varyant çarpımıyla üretiliyor. Bunu
  çözmek 5etools'un kendi yükleyicisini gerektiriyor — tarayıcı paketine
  girmesini istemediğimiz büyüklükte bir bağımlılık. Burada bir kez Node'da
  çalışıyor, uygulama yalnızca bitmiş kayıtları görüyor.
- Ham `data/` klasörü ~108 MB. Dışa aktarımdan çıkan şey küçük bir arama dizini
  (~930 KB) artı içerik parçaları; arama yalnızca dizine dokunuyor, bir
  statblock açmak tek bir parça (~120 kayıt) indiriyor.
- Canlı 5e.tools'a tarayıcıdan bağlanmak zaten mümkün değil: her veri yoluna
  Cloudflare bot doğrulaması dönüyor (`cf-mitigated: challenge`, HTTP 403), hiç
  `access-control-allow-origin` başlığı yok ve üstüne
  `cross-origin-embedder-policy: require-corp` var.

İndirilen dizinler ve parçalar IndexedDB'ye aynalanır; ilk oturumdan sonra
katalog tamamen çevrimdışı çalışır.

> `public/5etools/` `.gitignore`'da. Bu klasör senin kendi kopyandan türetilmiş
> telifli içerik — yeniden dağıtılacak bir şey değil, gerektiğinde yeniden üret.

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

**5etools homebrew dosyaları da doğrudan kabul edilir.** Ocak'taki içe aktarma
dosyanın hangi format olduğunu kendi anlar; 5etools brew'i ise yaratık/büyü/eşya
kayıtlarına çevrilir (`_copy` ile türetilen homebrew statblock'lar dahil).
Durum ve varyant kural girdileri bir derlemeye sığmadığı için atlanır ve uyarı
verilir — onları da istiyorsan dosyayı 5etools kaynağının `homebrew/` klasörüne
(veya `--brew` ile verdiğin bir klasöre) koyup dışa aktarımı yenile; o yol her
şeyi taşır ve kayıtlar aramada `HB` rozetiyle çıkar.

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
scripts/
  export-5etools.mjs   5etools kopyasını yerel kataloğa çevirir (Node)
src/
  lib/
    dice.ts        zar ifadesi çözümleyici
    open5e.ts      Open5e istemcisi + çevrimdışı yedek
    dnd5eapi.ts    hızlı SRD aynası (şema normalizasyonu)
    fivetools.ts   yerel katalog: dizin araması, parça çekme, IndexedDB aynası
    fivetools-convert.mjs
                   5etools → iç şema dönüşümü (Node ve tarayıcı ortak kullanır)
    live.ts        kaynak yarıştırma, ölçüm, ısıtma
    srd.ts         çevrimdışı başvuru tabloları
    homebrew.ts    derleme şeması, içe/dışa aktarma (5etools brew tanıma dahil)
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

Kod MIT. Ağdan gelen oyun içeriği ilgili açık lisansları altındadır
(OGL 1.0a / CC-BY-4.0 / ORC).

`npm run data:5etools` ile ürettiğin yerel katalog bu kapsamın dışındadır: senin
kendi kopyandan türetilmiş, telifi sahiplerine ait içeriktir. Kendi masan için
kullan; dağıtma. Bu yüzden `public/5etools/` `.gitignore`'dadır ve depoya hiçbir
5etools verisi girmez.
