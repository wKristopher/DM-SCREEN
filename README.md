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
npm run test       # zar motoru + niyet yönlendirici testleri
npm run check      # typecheck + test + build
```

Tamamen statik bir site: `dist/` klasörünü Vercel, Netlify, GitHub Pages ya da
kendi sunucuna koyabilirsin. Backend gerekmez.

---

## Veri kaynakları

İçerik [Open5e](https://open5e.com) üzerinden gelir — yalnızca **açık lisanslı**
materyal:

- **SRD 5.1** (OGL 1.0a) — çekirdek kurallar, yaratıklar, büyüler
- **Kobold Press** — Tome of Beasts 1–3, Creature Codex, Deep Magic, Vault of Magic (OGL)
- **Level Up: Advanced 5e** (CC-BY-4.0)
- **Black Flag SRD** (ORC)
- **Critical Role: Tal'Dorei** (OGL)

Hangi kitapların taranacağını Derleme → Kaynaklar'dan seçebilirsin.

> Kapalı lisanslı içerik (yayıncının satın alınması gereken kitapları) bilerek
> dahil edilmedi. Onları kullanmak istiyorsan, sahip olduğun materyali Ocak
> sekmesinden kendi derlemene girebilirsin.

**Çevrimdışı:** Açtığın her şey `localStorage`'a önbelleklenir ve internet gidince
de açılır. Ekran sekmesi ve Kâhin zaten hiç ağ kullanmaz.

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

## İsteğe bağlı: Claude

Kâhin'in tamamı **anahtar gerektirmeden** çalışır. İstersen Kampanya → Ayarlar'dan
bir Anthropic API anahtarı ekleyip serbest metin de aldırabilirsin: betimleme,
NPC replikleri, seans özeti.

Anahtar yalnızca senin tarayıcında saklanır ve doğrudan Anthropic'e gider —
arada sunucu yok. SDK ayrı bir parçaya bölünmüştür, bu özelliği açmazsan hiç
indirilmez.

---

## Teknik notlar

- React 19 + TypeScript + Vite, durum yönetimi Zustand (`persist` ile localStorage)
- Tailwind v4, tema tokenları CSS değişkenlerinde — `dusk` (karanlık) ve
  `parchment` (aydınlık)
- Dış font/ikon/görsel yok: ikonlar satır içi SVG, doku SVG filtresi
- Zar motoru `kh/kl/dh/dl`, `r/ro`, `!`, `min/max`, parantez ve karma terimleri
  destekler; zarlar `crypto.getRandomValues` ile ret örneklemesi kullanır

```
src/
  lib/
    dice.ts        zar ifadesi çözümleyici
    open5e.ts      API istemcisi + önbellek
    srd.ts         çevrimdışı başvuru tabloları
    homebrew.ts    derleme şeması, içe/dışa aktarma
    ai/
      tables.ts    üretici veri bankaları
      generators.ts üreticiler
      oracle.ts    komut çubuğu niyet yönlendirici
      llm.ts       isteğe bağlı Claude köprüsü
  store/           zustand store'ları
  components/      paneller
```

## Lisans

Kod MIT. Oyun içeriği ilgili açık lisansları altındadır (OGL 1.0a / CC-BY-4.0 / ORC).
