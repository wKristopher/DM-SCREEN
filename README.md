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

### Oyuncu ekranı (ikinci ekran)

Savaş sekmesindeki **Oyuncu ekranı** düğmesi ikinci bir pencere açar; TV'ye ya da
yan monitöre sürükle. Masa inisiyatif sırasını, kimin sırada olduğunu ve turu
uzaktan okunacak boyutta görür.

Sunucu yok, ikinci hesap yok, ikinci cihaz yok: aynı origin, aynı giriş. DM'in
penceresi her değişiklikte `localStorage`'a yazıyor; `storage` olayı **diğer**
sekmelerde tetiklendiği için ikinci pencere anında tazeleniyor. (Roll20'de aynı
şey iki hesap ve iki tarayıcı istiyor.)

Masanın **görmediği** iki şey var, ve kuralı `src/lib/table.ts`'te tek bir yerde
duruyor — çünkü ekrana sızan bir sayı geri alınamaz:

- **Gizli işaretli hiçbir şey görünmez.** Soluk da değil, boş satır da değil,
  sırada boşluk da değil — boşluğun kendisi bilgidir. Gizli bir yaratığın sırası
  geldiğinde ekranda kimse vurgulanmaz.
- **Yaratıkların HP'si sayı değil kelime.** `sağlam · sıyrık almış · kanıyor ·
  ayakta zor duruyor · düştü`. *Kanıyor* eşiği 5e'nin *bloodied* tanımıyla aynı
  yerde (yarı ve altı), *sağlam* ise hiç hasar almamış demek — %90 canlı bir
  yaratığı sağlam göstermek masaya yanlış bilgi verir.

Oyuncu karakterlerinin HP'si açık gösterilir; zaten kendi sayılarını biliyorlar.
Konsantrasyon "var" olarak geçer, hangi büyü olduğu geçmez.

Yanındaki kutuya yazdığın satır ekranda büyük punto belirir — "Kapı içeriden
sürgülü." gibi. Sahne notunu söylemek yerine gösterirsin.

### Karakter kağıtları

Kampanya → Grup'ta her oyuncu karakteri **statblock gibi** açılır: aynı düzen,
aynı dil, aynı zar düğmeleri. Yaratıkla karakter arasında gidip gelirken ikisinin
farklı okunması masada her seferinde bir saniye yiyor.

Kartta ne var: AC, HP, hız, inisiyatif, üç passive skor, altı yetenek (tıklayınca
kontrol atar), kurtarma ve beceri yeterlilikleri, duyular, diller, dirençler,
spell save DC ve saldırılar (hasar zarı atılabilir).

**Türetilebilen hiçbir şey elle yazılmaz.** Yeterlilik bonusu seviyeden, kurtarma
ve beceri toplamları puan + yeterlilikten, passive skorlar `10 + beceri`'den,
spell DC `8 + yeterlilik + yetenek`'ten hesaplanır. Elle girilen bir roster iki
seviye sonra sessizce yanlıştır ve ona güvenen DM bunu hiç fark etmez. Sen
puanları girersin, sonuçlar kendi kendini düzeltir — seviye 5'ten 9'a çıktığında
passive Perception 15'ten 16'ya kimse dokunmadan gider.

Beceri kutusuna bir kez tıkla yeterlilik, iki kez uzmanlık (`∗`, yeterlilik iki
kez sayılır), üç kez temizler. Grubu savaşa eklerken inisiyatif artık gerçek DEX
modifikatörüyle atılır.

Eski roster'lar bozulmaz: üç passive skoru elle tutan kayıtlar taşınır ve "elle"
diye işaretlenir; yanındaki düğme hesaplanan değere döndürür.

### Zar: iki mod

Zar panelinin başında iki mod var — hangisinin açık olduğu her zaman görünür.

| Mod | Ne yapar | d20 ortalaması |
|---|---|---|
| **Adil** | dürüst zar, düz dağılım | 10.5 |
| **Kayırmalı · Hafif** | zarların %35'i iki kez atılıp iyisi alınır | 11.66 |
| **Kayırmalı · Orta** | %70 | 12.83 |
| **Kayırmalı · Güçlü** | %100 — yani her zarda avantaj | 13.83 |

Kayırma tek bir zarın *kendisine* uygulanır, sonuca değil: `4d6kh3`, `2d20kl1`,
`8d6!` gibi ifadeler bozulmadan çalışmaya devam eder, sadece her zar yükseğe
meyleder. Olasılık olarak ifade edilmesinin sebebi ayarlanabilir olması —
"iki at, iyisini seç" d20'de +0'dan doğrudan +3.3'e sıçrar, arası yoktur.

Mod uygulamadaki **bütün** atışlar için geçerlidir (stat block saldırıları,
inisiyatif, komut çubuğu dahil) ve kayırmalı atışlar geçmişte `◆` ile
işaretlenir — DM'in hangi sayının yardım gördüğünü sonradan da görebilmesi için.

---

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
```

Diğer komutlar:

```bash
npm run build      # dist/ üretir — herhangi bir statik hosta atılabilir
npm run test       # 438 test: zar, kâhin, şema, sağlayıcılar, kimlik, yedek, içe aktarma, 5etools, karakter, oyuncu ekranı
npm run check      # typecheck + test + build
npm run test:deploy # Vercel'in kendi derleyicisini yerelde koşturur
```

---

## Yayına alma ve giriş koruması

Site herkese açık olmasın diye giriş **kenar (edge) tarafında** zorlanır. Bunun
tarayıcıda çizilen bir giriş ekranından farkı şu: geçerli oturum çerezi yoksa
ziyaretçi HTML kabuğunu, JS paketini, CSS'i — **hiçbirini** indiremez. Sadece
giriş sayfasını görür.

```
middleware.ts        her isteği karşılar, imzalı çerezi doğrular
api/login.ts         kullanıcı adı + şifreyi sunucuda kontrol eder, çerezi verir
api/logout.ts        çerezi siler
lib/auth.ts          PBKDF2 doğrulama + HMAC imzalı oturum (yalnızca sunucuda)
public/login.html    paketten bağımsız, tek başına duran giriş sayfası
```

Depoda hiçbir kimlik bilgisi yok — ne şifre, ne hash, ne de bir örnek dosya.
Hepsi ortam değişkeninden okunur. Değişkenler tanımlı değilse site **kilitli
kalır** (her giriş reddedilir, `/api/login` 503 döner); yanlışlıkla herkese açık
bir dağıtım oluşmaz.

Şifre PBKDF2-SHA256 (210.000 tur, rastgele salt) ile saklanır; hiçbir zaman
istemci paketine girmez. Oturum çerezi `HttpOnly` + `Secure` + `SameSite=Lax`,
12 saat geçerli. Yanlış kullanıcı adı ile yanlış şifre **aynı** mesajı döner
(hesap sızdırmamak için) ve doğrulama sabit zamanlı karşılaştırma kullanır.

### Vercel'e alma

**1. Hesabı üret.** Şifreyi hiçbir yere yazmadan, yalnızca hash'ini çıkar:

```bash
node -e "const c=require('crypto');const salt=c.randomBytes(16).toString('hex');
console.log('ADMIN_SALT  =',salt);
console.log('ADMIN_HASH  =',c.pbkdf2Sync(process.argv[1],salt,210000,32,'sha256').toString('hex'));
console.log('AUTH_SECRET =',c.randomBytes(32).toString('hex'))" 'ŞİFREN'
```

**2. Projeyi kur.** İkisinden biri:

```bash
npx vercel --prod                 # bu klasörden doğrudan
```

ya da [vercel.com/new](https://vercel.com/new) → depoyu seç → **Import**
(framework otomatik algılanır: Vite, çıktı `dist/`).

**3. Dört değişkeni gir** (Vercel → Project → Settings → Environment Variables,
Production + Preview) ve yeniden dağıt:

| Değişken | Ne |
|---|---|
| `ADMIN_USER` | kullanıcı adı |
| `ADMIN_SALT` | rastgele salt (hex) |
| `ADMIN_HASH` | PBKDF2-SHA256, 210k tur, 32 bayt (hex) |
| `AUTH_SECRET` | oturum imzalama anahtarı (32 rastgele bayt, hex) |

Şifreyi değiştirmek = `ADMIN_SALT` + `ADMIN_HASH` değerlerini yenilemek; kod
değişmez. `AUTH_SECRET`'i değiştirmek açık tüm oturumları anında düşürür.

> **Şifre uzunluğu hakkında:** kısa ve yalnızca rakamlardan oluşan şifrelerin
> olasılık uzayı küçüktür — deneme yanılma ile bulunabilirler. `api/login.ts` IP
> başına 10 dakikada 10 denemeyle sınırlar ve PBKDF2 her denemeyi ~200ms'e
> çıkarır, ama kararlı bir saldırgan için bu yavaşlatmadır, duvar değil. Uzun
> bir parola çok daha iyi korur ve yukarıdaki komutla dakikalar içinde
> değiştirilir.

Test etmek için:

```bash
npm run test:gate     # gerçek middleware + giriş uç noktası, gerçek tarayıcı
npm run test:deploy   # Vercel'in derleyicisi: middleware + iki uç nokta gerçekten kuruluyor mu
```

Testler gerçek şifreyi bilmez: `test/gate-account.mjs` her koşuda kendi tek
kullanımlık hesabını üretir.

> **TypeScript 5.x'te sabitli — yükseltme.** `middleware.ts` ve `api/*.ts`
> dosyalarını derleyen Vercel değil, projenin kendi TypeScript'i. TypeScript 7
> (yerel koda yeniden yazılmış sürüm) eski derleyici API'sini sunmadığı için
> derleme `Cannot read properties of undefined (reading 'readFile')` ile
> düşüyor — üstelik `npm run check` bunu göremiyor, çünkü `vite build` yalnızca
> istemciyi derler. `npm run test:deploy` tam da bu boşluğu kapatmak için var.

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

### Klasörden toplu içe aktarma

Homebrew tek dosya hâlinde birikmez: kampanya başına bir klasör, yaratık başına
bir dosya olur. Ocak → **Klasör** bir dizinin tamamını tek seferde alır (alt
klasörler dahil). İki kural:

- **Dosyanın ne olduğu içeriğinden anlaşılır.** Çoğu dosya Kâhin derlemesi
  değildir — çıplak bir yaratık, ya da başka bir araçtan çıkmış bir büyü
  dizisidir. Yalnızca tek bir türde bulunan alanlara bakılır
  (`challenge_rating` → yaratık, `casting_time` → büyü); `level` gibi paylaşılan
  alanlar tek başına karar vermez.
- **Klasör birimdir.** Yirmi yaratık dosyasının yirmi ayrı derleme olması,
  klasörün kendisinden daha dağınık olurdu. Serbest dosyalar bulundukları
  dizinin adını taşıyan tek bir derlemede toplanır; zaten tam bir derleme olan
  dosya kendi adını ve kimliğini korur.

Hiçbir şey sorulmadan eklenmez: kaç dosya tarandı, hangi derlemeler çıkacak,
hangi dosyalar neden atlandı — hepsi önce ekranda listelenir. Atlananlar
sayılmaz, tek tek yazılır; "12 dosya atlandı" kimseye hangi on iki olduğunu
söylemez. Yanlışlıkla klasöre düşmüş bir yedek dosyası da tanınır ve doğru
sekmeye yönlendirilir.

### 5etools homebrew

Ocak → **5etools** düğmesi
[TheGiddyLimit/homebrew](https://github.com/TheGiddyLimit/homebrew) deposunu
uygulama içinden gezdirir: ara, bir dosyaya tıkla, tarayıcın doğrudan GitHub'dan
çekip Kâhin biçimine çevirsin. Ölçüm: *Tome of Beasts 2* dosyası 420 yaratık +
6 eşya, ~95 ms'de dönüşüyor.

Depo kendi dosya listesini `_generated/index-props.json` altında yayınlıyor ve
raw.githubusercontent.com `access-control-allow-origin: *` gönderiyor. Bunun
sonucu önemli: **GitHub API'ye gerek yok** — token yok, saatlik istek sınırı
yok, araya giren bir sunucumuz yok. 729 kullanılabilir dosya listeleniyor.

Şema tamamen farklı, o yüzden bir çevirici var (`src/lib/fivetools.ts`):

| 5etools | Kâhin |
|---|---|
| `{monster: […]}` | `monsters` |
| `size: ["H"]`, `alignment: ["C","E"]` | `Huge`, `chaotic evil` |
| `ac: [{ac:14, from:["natural armor"]}]` | `armor_class` + `armor_desc` |
| `hp: {average, formula}` | `hit_points` + `hit_dice` |
| `str/dex/con…`, `cr: "1/8"` | `strength/dexterity/…`, `cr: 0.125` |

En çok emek gereken kısım metin. Kaynak, kendi işaretleme dilinde yazılmış:

```
{@atk mw} {@hit +8} to hit, reach 5 ft. {@h}12 ({@damage 2d6 + 5}) piercing damage.
→  Melee Weapon Attack: +8 to hit, reach 5 ft. Hit: 12 (2d6 + 5) piercing damage.
```

Bu çözülmezse içe aktarılan statblock, hiç aktarılmamış olmasından kötüdür.
`{@hit}` iki türlü de yazılıyor (`8` ve `+8`) — yalnızca işaretsiz olana işaret
ekleniyor, yoksa satır `++8` diye okunuyor.

Çeviri tek yönde kayıplı: temsil edemediğimiz alan **düşürülür, uydurulmaz**.
HP'si metin olarak yazılmış bir yaratık ("efendisininkine eşit") 0 HP ve o metinle
gelir, kimsenin atmadığı bir sayıyla değil.

> Bu içerik topluluk üyelerinin yazıp paylaştığı homebrew'dur; resmî kitap metni
> değildir. Alınan her şey yalnızca senin tarayıcında durur.

---

## Yedekleme

Hesap yok, sunucu yok — bunun bedeli, her şeyin tek bir tarayıcının
`localStorage`'ında durması. Tarayıcıyı temizlemek ya da başka bir cihaza
geçmek kampanyayı götürür. Kampanya → Ayarlar'daki **Yedekle ve geri yükle**
bunu kapatır: grup, notlar, günlük, derlemeler, savaş durumu ve ayarlar tek bir
`kahin-yedek-YYYY-AA-GG.json` dosyasında.

İki ayrıntı bilerek böyle:

- **API anahtarları dosyaya yazılmaz.** Yedek e-postayla kendine gönderilen,
  paylaşılan bir dosyadır; anahtarın onunla seyahat etmesi çok masum görünen bir
  sızıntı olurdu. Sağlayıcı ve model tercihi kalır, anahtar kalmaz.
- **Geri yükleme iki adımlıdır.** Dosya seçilir, içinde ne olduğu (tarih, kaç
  karakter, kaç günlük satırı, kaç derleme) ekranda gösterilir, sonra onaylanır.
  Aylık notların üstüne tek tıkla yazan bir özellik, olmayan özellikten kötüdür.

Geri yükleme tarayıcıda hâlihazırda girili olan API anahtarlarını silmez.

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
