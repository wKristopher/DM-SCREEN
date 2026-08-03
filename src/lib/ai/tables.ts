/**
 * Source tables for the local oracle.
 *
 * This is the "small AI" running entirely in the browser: no API key, no
 * network, no cost. It is a weighted procedural generator over hand-written
 * tables, which for improvisation at the table beats a language model on the
 * two axes that matter — it answers in under a millisecond, and it never
 * invents a rule that does not exist.
 */

export const NAME_BANKS: Record<string, { male: string[]; female: string[]; surname: string[] }> = {
  'İnsan (Batı)': {
    male: ['Aldric', 'Bennet', 'Cedric', 'Doran', 'Edmund', 'Gareth', 'Harlan', 'Joric', 'Konrad', 'Leofric', 'Marek', 'Osric', 'Perrin', 'Roderick', 'Stellan', 'Tobias', 'Ulric', 'Warrick'],
    female: ['Adeline', 'Brienne', 'Cordelia', 'Delphine', 'Elowen', 'Freya', 'Gwendolyn', 'Helena', 'Isolde', 'Junia', 'Katarin', 'Lyra', 'Marisol', 'Norra', 'Ophelia', 'Rowena', 'Sabine', 'Verity'],
    surname: ['Ashdown', 'Blackmoor', 'Cardew', 'Dunmore', 'Eastvale', 'Fairbrook', 'Grimsby', 'Hallowell', 'Ironwood', 'Larkspur', 'Marchetti', 'Northgate', 'Ravenscroft', 'Stormwell', 'Thorne', 'Vandermere', 'Whitlock'],
  },
  'İnsan (Doğu)': {
    male: ['Arslan', 'Bahadır', 'Cengiz', 'Demir', 'Emre', 'Ferhat', 'Görkem', 'Hakan', 'Kaya', 'Levent', 'Mert', 'Orhan', 'Sinan', 'Tarkan', 'Uluç', 'Yavuz'],
    female: ['Ayla', 'Bengi', 'Ceren', 'Defne', 'Elif', 'Gonca', 'Hande', 'Ilgaz', 'Jale', 'Kumsal', 'Lale', 'Melis', 'Nergis', 'Pınar', 'Selen', 'Yaren'],
    surname: ['Akbulut', 'Barış', 'Çelikkaya', 'Demirhan', 'Ergen', 'Fidan', 'Gökmen', 'Hatipoğlu', 'Karaca', 'Mercan', 'Özdemir', 'Poyraz', 'Sarptekin', 'Tunçel', 'Yıldırım'],
  },
  Elf: {
    male: ['Aelar', 'Beiro', 'Carric', 'Dayereth', 'Enialis', 'Fivin', 'Galinndan', 'Hadarai', 'Immeral', 'Ivellios', 'Laucian', 'Mindartis', 'Paelias', 'Riardon', 'Soveliss', 'Thamior', 'Varis'],
    female: ['Adrie', 'Birel', 'Caelynn', 'Drusilia', 'Enna', 'Felosial', 'Ielenia', 'Jelenneth', 'Keyleth', 'Leshanna', 'Meriele', 'Naivara', 'Quelenna', 'Sariel', 'Shanairra', 'Theirastra', 'Valanthe'],
    surname: ['Amakiir', 'Amastacia', 'Galanodel', 'Holimion', 'Ilphelkiir', 'Liadon', 'Meliamne', 'Naïlo', 'Siannodel', 'Xiloscient'],
  },
  Cüce: {
    male: ['Adrik', 'Baern', 'Darrak', 'Eberk', 'Fargrim', 'Gardain', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Rangrim', 'Thoradin', 'Tordek', 'Ulfgar', 'Vondal'],
    female: ['Amber', 'Bardryn', 'Dagnal', 'Eldeth', 'Gunnloda', 'Helja', 'Hlin', 'Kathra', 'Kristryd', 'Mardred', 'Riswynn', 'Sannl', 'Torbera', 'Vistra'],
    surname: ['Balderk', 'Battlehammer', 'Brawnanvil', 'Dankil', 'Fireforge', 'Frostbeard', 'Gorunn', 'Holderhek', 'Ironfist', 'Loderr', 'Rumnaheim', 'Strakeln', 'Torunn', 'Ungart'],
  },
  Halfling: {
    male: ['Alton', 'Ander', 'Cade', 'Corrin', 'Eldon', 'Errich', 'Finnan', 'Garret', 'Lindal', 'Lyle', 'Merric', 'Milo', 'Osborn', 'Perrin', 'Reed', 'Roscoe', 'Wellby'],
    female: ['Andry', 'Bree', 'Callie', 'Cora', 'Euphemia', 'Jillian', 'Kithri', 'Lavinia', 'Lidda', 'Merla', 'Nedda', 'Paela', 'Portia', 'Seraphina', 'Shaena', 'Trym', 'Verna'],
    surname: ['Brushgather', 'Goodbarrel', 'Greenbottle', 'High-hill', 'Hilltopple', 'Leagallow', 'Tealeaf', 'Thorngage', 'Tosscobble', 'Underbough'],
  },
  Tiefling: {
    male: ['Akmenos', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Melech', 'Mordai', 'Morthos', 'Pelaios', 'Skamos', 'Therai'],
    female: ['Akta', 'Anakis', 'Bryseis', 'Criella', 'Damaia', 'Ea', 'Kallista', 'Lerissa', 'Makaria', 'Nemeia', 'Orianna', 'Phelaia', 'Rieta'],
    surname: ['Carrion', 'Despair', 'Fear', 'Glory', 'Hope', 'Ideal', 'Music', 'Nowhere', 'Open', 'Poetry', 'Quest', 'Random', 'Reverence', 'Sorrow', 'Temerity', 'Torment'],
  },
  Orc: {
    male: ['Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Krusk', 'Mhurren', 'Ront', 'Shump', 'Thokk', 'Ugarth'],
    female: ['Baggi', 'Emen', 'Engong', 'Kansif', 'Myev', 'Neega', 'Ovak', 'Ownka', 'Shautha', 'Sutha', 'Vola', 'Volen', 'Yevelda'],
    surname: ['Skullcleaver', 'Bonegnasher', 'Ironjaw', 'Bloodtusk', 'Skarnfang', 'Ashmaw', 'Grimhowl'],
  },
  Ejderha: {
    male: ['Arjhan', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Nadarr', 'Pandjed', 'Patrin', 'Rhogar', 'Shamash', 'Torinn'],
    female: ['Akra', 'Biri', 'Daar', 'Farideh', 'Harann', 'Havilar', 'Jheri', 'Kava', 'Korinn', 'Mishann', 'Nala', 'Perra', 'Raiann', 'Sora', 'Thava', 'Uadjit'],
    surname: ['Clethtinthiallor', 'Daardendrian', 'Delmirev', 'Drachedandion', 'Fenkenkabradon', 'Kepeshkmolik', 'Kerrhylon', 'Myastan', 'Nemmonis', 'Prexijandilin', 'Yarjerit'],
  },
}

export const NPC_APPEARANCE = [
  'bir gözü sütbeyaz, kör', 'çenesinde eski bir bıçak yarası', 'saçları erken beyazlamış',
  'parmakları mürekkep lekeli', 'boynunda solmuş bir dövme', 'kaşlarından biri yanıkla silinmiş',
  'olağanüstü uzun ve zayıf', 'kısa boylu ama fıçı göğüslü', 'sürekli hafifçe titreyen elleri',
  'altın bir ön dişi var', 'kulağının yarısı kopmuş', 'yürürken belli belirsiz aksıyor',
  'gözleri şaşırtıcı derecede açık mavi', 'yüzü çiçek bozuğu', 'sakalı örgülü ve boncuklu',
  'bileklerinde zincir izleri', 'ellerinde iyileşmemiş yanıklar', 'burnu iki kez kırılmış',
  'omzunda evcil bir kuzgun', 'gözlerinin altında derin morluklar', 'göz kamaştırıcı derecede güzel',
  'terlemiş, sürekli mendil kullanıyor', 'tek elinde altı parmak',
]

export const NPC_QUIRK = [
  'her cümlenin sonunda güler', 'asla göz teması kurmaz', 'sürekli bozuk para çevirir',
  'kendinden üçüncü tekil şahısla bahseder', 'her şeyin fiyatını sorar', 'konuşurken fısıldar',
  'sizi tanıdığına yemin eder', 'her sözünde bir atasözü kullanır', 'aşırı temizlik takıntılı',
  'sürekli omzunun üstünden bakar', 'isimleri sürekli yanlış söyler', 'yalan söylerken kaşını kaşır',
  'her fırsatta annesinden bahseder', 'çok yavaş ve dikkatli konuşur', 'gülünce ses çıkarmaz',
  'hediye vermeyi sever', 'her konuyu hava durumuna bağlar', 'yemek yerken konuşmaz',
  'sürekli bir şey çiziktirir', 'kendi şakalarına aşırı güler', 'insanların cümlelerini tamamlar',
  'tanrıların adını sık anar', 'sürekli bir şeyler mırıldanır',
]

export const NPC_MOTIVATION = [
  'kayıp kardeşini arıyor', 'bir borcu kapatmaya çalışıyor', 'ailesinin adını temizlemek istiyor',
  'ölmeden önce denizi görmek istiyor', 'bir tarikattan kaçıyor', 'çocuğuna miras bırakmak istiyor',
  'eski bir hatayı telafi etmeye çalışıyor', 'bir soyluya intikam yemini etti',
  'yasak bir bilgiyi arıyor', 'sadece hayatta kalmak istiyor', 'lonca içinde yükselmek istiyor',
  'birine âşık ama söyleyemiyor', 'bir hastalığa çare arıyor', 'kayıp bir eseri geri getirmek zorunda',
  'kendi kasabasını terk etmek istiyor', 'unutulmaktan korkuyor', 'bir kehaneti çürütmeye çalışıyor',
  'çalınan bir şeyi geri almak istiyor',
]

export const NPC_SECRET = [
  'aslında bir suçlunun kardeşi', 'gizlice bir tarikata üye', 'kimliğini değiştirmiş bir asker kaçağı',
  'yıllardır aynı rüyayı görüyor', 'aradığınız kişiyi tanıyor ama saklıyor',
  'zaten öldü, farkında değil', 'bir şeytanla anlaşma yaptı', 'sahte belgelerle yaşıyor',
  'bir cinayete tanık oldu ve sustu', 'gizli bir büyücü', 'aslında polymorph olmuş bir yaratık',
  'çalınan malları saklıyor', 'bir soylunun gayrimeşru çocuğu', 'başka biri adına casusluk yapıyor',
  'geçmişini tamamen uydurdu', 'bir laneti taşıyor', 'lonca kasasından çalıyor',
  'aslında yardım etmek için gönderildi',
]

export const NPC_VOICE = [
  'boğuk ve yorgun', 'tiz ve hızlı', 'yavaş, ölçülü, ağır', 'kırık bir aksanla',
  'fısıltıyla, hep', 'gürleyen ve neşeli', 'burnundan konuşur gibi', 'şarkı söyler gibi ezgili',
  'kelimeleri yutarak', 'aşırı kibar ve resmî', 'her cümlede duraksayarak', 'alaycı ve keskin',
  'nefes nefese', 'sıcak ve annelik eden', 'soğuk ve mesafeli',
]

export const NPC_ROLE = [
  'hancı', 'demirci', 'muhafız çavuşu', 'seyyar satıcı', 'rahip', 'balıkçı', 'kâtip', 'simsar',
  'at bakıcısı', 'ozan', 'fırıncı', 'mezarcı', 'avcı', 'kervan sürücüsü', 'eczacı', 'yankesici',
  'liman işçisi', 'noter', 'öğretmen', 'cellat', 'meyhaneci kızı', 'lonca ustası', 'dilenci',
  'haritacı', 'zindancı', 'değirmenci', 'tefeci', 'şifacı', 'kalfa', 'gemi kaptanı',
]

export const TAVERN_ADJ = ['Sarhoş', 'Kırık', 'Altın', 'Kanlı', 'Yeşil', 'Sessiz', 'Üç', 'Asılmış', 'Uykulu', 'Paslı', 'Şişman', 'Gülen', 'Son', 'Kayıp', 'Yaşlı', 'Gümüş', 'Kör', 'Aç']
export const TAVERN_NOUN = ['Ejderha', 'Kazan', 'Şahin', 'Örs', 'Meşe', 'Domuz', 'Fıçı', 'Kuzgun', 'Kral', 'Balta', 'Kadeh', 'Yılan', 'Fener', 'Tilki', 'Çıpa', 'Ayı', 'Kedi', 'Değirmen']

export const TAVERN_FEATURE = [
  'ocakta sürekli yanan devasa bir ateş', 'tavandan sarkan bir gemi direği',
  'duvarda konuşan bir geyik kafası', 'her masada farklı bir oyma', 'zemin katta bir kuyu',
  'sahibinin yaşlı, kör köpeği', 'duvarları kaplayan yüzlerce anahtar', 'bodrumda gizli bir kapı',
  'her gece çalan aynı acemi ozan', 'tavana çivilenmiş bir kılıç', 'içerideki küçük bir şelale',
  'kalıcı bir prestidigitation kokusu', 'müdavimlerin adının kazındığı bar',
  'köşede sürekli satranç oynayan iki ihtiyar',
]

export const TAVERN_DRINK = [
  'Cücebiti (acı, siyah, köpüklü)', 'Bataklık Balı (aşırı tatlı)', 'Kış Ateşi (boğazı yakar)',
  'Elf Şarabı (fazla pahalı)', 'Ork Kanı (kırmızı, bulanık)', 'Denizci Çayı (romlu)',
  'Gümüş Sis (buharı tütüyor)', 'Rahibin Gözyaşı (sulandırılmış)', 'Kara Değirmen (koyu arpa birası)',
]

export const RUMOR = [
  'değirmencinin kızı üç gündür kayıp',
  'ormanda geceleri çan sesi duyuluyor',
  'lord yeni bir vergi hazırlıyormuş',
  'mezarlıkta taze topraklar kendiliğinden kazılmış',
  'kervanlar iki haftadır güneyden gelmiyor',
  'kuyunun suyu tuzlanmaya başladı',
  'kilisenin rahibi bir haftadır ayin yapmıyor',
  'harabelerde ışık görenler var',
  'bir yabancı, herkesin adını biliyormuş gibi davranıyor',
  'sığırlar kanları çekilmiş halde bulunuyor',
  'belediye kâtibi aniden zenginleşti',
  'nehirden yukarı doğru yüzen bir ceset geldi',
  'geceleri limanda isimsiz bir gemi demirliyor',
  'çocuklar hiç kimsenin öğretmediği bir tekerleme söylüyor',
]

export const PLOT_HOOK_WHO = ['yaşlı bir rahip', 'panik içindeki bir tüccar', 'sessiz bir çocuk', 'yaralı bir muhafız', 'kibirli bir soylu', 'gizemli bir yabancı', 'ağlayan bir dul', 'sarhoş bir asker', 'kaçak bir büyücü', 'kör bir kâhin']
export const PLOT_HOOK_WANTS = ['bir şeyi geri getirmenizi', 'birini bulmanızı', 'bir yeri araştırmanızı', 'birini korumanızı', 'bir şeyi yok etmenizi', 'bir mesajı iletmenizi', 'birini takip etmenizi', 'bir borcu tahsil etmenizi', 'bir töreni durdurmanızı', 'birini kaçırmanızı']
export const PLOT_HOOK_TWIST = [
  'ama söylediği kişi çoktan ölmüş',
  'ama asıl amacı sizi oradan uzak tutmak',
  'ama ödeme sözü verdiği para ona ait değil',
  'ama aradığı şey aslında bir tuzak',
  'ama olayın sorumlusu kendisi',
  'ama gerçeği bilirse kendini öldürecek',
  'ama size yalan söylemek zorunda bırakıldı',
  'ama hedef sizden birinin akrabası',
  'ama bunu daha önce üç maceracı grubuna sordu',
  'ama zamanı yok — bu gece dolunay',
]

export const WEATHER = [
  { name: 'Berrak ve serin', effect: 'Etki yok' },
  { name: 'Alçak sis', effect: 'Görüş 60 ft ile sınırlı, lightly obscured' },
  { name: 'Sağanak yağmur', effect: 'Perception disadvantage, açık alev söner' },
  { name: 'Şiddetli rüzgâr', effect: 'Menzilli saldırı disadvantage, uçuş zor' },
  { name: 'Kar fırtınası', effect: 'Görüş 30 ft, zorlu arazi, CON save veya exhaustion' },
  { name: 'Boğucu sıcak', effect: 'Her saat DC 5 CON save, yoksa exhaustion' },
  { name: 'Kapalı ve boğucu', effect: 'Etki yok, ama moraller düşük' },
  { name: 'Fırtına ve şimşek', effect: 'Perception disadvantage, uzaktan konuşma imkânsız' },
  { name: 'Çiseleyen soğuk yağmur', effect: 'Uzun süre kalınırsa exhaustion riski' },
  { name: 'Olağandışı sıcak bir gece', effect: 'Uyumak zor, long rest yarım fayda' },
]

export const ROOM_FEATURE = [
  'tavandan damlayan su, taşta bir havuz oluşturmuş',
  'duvarlarda kazınmış, okunmayan bir alfabe',
  'köşede yığılmış, tanımlanamayan kemikler',
  'yerde bir zamanlar bir daire çizilmiş, tebeşir solmuş',
  'devrilmiş bir masa, üstünde kurumuş bir yemek',
  'duvara zincirlenmiş boş bir kelepçe çifti',
  'yerde bir kan izi, kapının altından geçip kayboluyor',
  'tozla kaplı bir ayna, üstünde bir el izi',
  'tavanda hâlâ sallanan kırık bir avize',
  'duvara dayalı, mühürlü üç sandık',
  'ortada sönmüş bir mangal, külü hâlâ sıcak',
  'zeminde bir kapak, üstüne halı çekilmiş',
]

export const SMELL = ['küf ve ıslak taş', 'yanık saç', 'bayat bira', 'tütsü ve balmumu', 'demir ve kan', 'çürük et', 'lavanta, fazlasıyla', 'deniz tuzu ve katran', 'toprak ve kök', 'kükürt']
export const SOUND = ['uzakta damlayan su', 'ahşabın çatırtısı', 'boğuk bir uğultu', 'kanat çırpışı', 'ritmik bir kazıma sesi', 'rüzgârın ıslığı', 'zincir şıkırtısı', 'çok uzakta bir çan', 'tam bir sessizlik', 'fısıldayan sesler, kelimeler seçilmiyor']

export const TREASURE_ART = [
  'gümüş kakmalı bir fildişi tarak (25 gp)',
  'siyah kadife bir kese içinde 12 zar (25 gp)',
  'küçük altın bir bilezik (25 gp)',
  'gümüş bir kadeh, kenarı çentikli (25 gp)',
  'elektrum bir tören maskesi (250 gp)',
  'yeşim taşından bir heykelcik (250 gp)',
  'işlemeli ipek bir cübbe (250 gp)',
  'altın kaplama bir kuş kafesi (250 gp)',
  'zümrüt gözlü altın bir yılan bilezik (2 500 gp)',
  'platin ve safir bir taç (7 500 gp)',
]

export const TREASURE_ODDITY = [
  'kapanmayan bir cep saati', 'yalnızca ay ışığında okunan bir mektup',
  'sahibi öldüğünde soğuyan bir yüzük', 'içinde donmuş bir sinek olan kehribar',
  'hep kuzeyi gösteren kırık bir pusula', 'adı silinmiş bir mezar taşı parçası',
  'boş ama ağır bir şişe', 'kendi kendine örülen bir yün yumağı',
  'sahibinin sesini tekrarlayan bir midye kabuğu', 'her gün bir sayfası eksilen bir günlük',
]

export const SETTLEMENT_PROBLEM = [
  'kuyular kurumaya başladı', 'lonca ile kilise açık çatışmada',
  'muhafız komutanı rüşvet alıyor', 'bir salgın karantinaya yol açtı',
  'kervan yolu haydutlarca kesildi', 'yeni gelen bir tarikat hızla büyüyor',
  'hasat ikinci kez tuttu tutmadı', 'iki aile arasında kan davası',
  'yabancılara kapılar kapatıldı', 'belediye başkanı iki haftadır ortada yok',
]

export const SETTLEMENT_QUIRK = [
  'burada kimse yüksek sesle gülmez', 'gün batımında tüm kapılar kilitlenir',
  'çocuklara 7 yaşına kadar isim verilmez', 'her evin kapısında tuz vardır',
  'pazar günü hiçbir demir alınıp satılmaz', 'ölüler yakılır, gömülmez',
  'yabancılar önce kahve içmeden konuşamaz', 'her yıl bir kişi kurayla sürgün edilir',
  'kasabanın tek bir saati vardır ve hep yanlıştır', 'burada herkes aynı soyadı taşır',
]

export const SHOP_TYPE = ['demirci', 'aktar', 'kitapçı', 'kumaşçı', 'silah tüccarı', 'mücevherci', 'marangoz', 'fırın', 'at pazarı', 'simyacı', 'derici', 'balıkçı tezgâhı']

export const ENVIRONMENTS = ['orman', 'dağ', 'bataklık', 'çöl', 'yeraltı', 'kıyı', 'ova', 'şehir', 'arktik', 'harabe'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

/** Creature types that make sense per environment, used to bias monster picks. */
export const ENV_MONSTER_TYPES: Record<Environment, string[]> = {
  orman: ['beast', 'fey', 'plant', 'humanoid', 'monstrosity'],
  dağ: ['giant', 'dragon', 'beast', 'monstrosity', 'elemental'],
  bataklık: ['ooze', 'undead', 'beast', 'monstrosity', 'plant'],
  çöl: ['elemental', 'monstrosity', 'undead', 'humanoid', 'dragon'],
  yeraltı: ['aberration', 'undead', 'ooze', 'monstrosity', 'humanoid'],
  kıyı: ['beast', 'monstrosity', 'humanoid', 'elemental'],
  ova: ['beast', 'humanoid', 'giant', 'monstrosity'],
  şehir: ['humanoid', 'undead', 'fiend', 'construct'],
  arktik: ['beast', 'giant', 'elemental', 'undead', 'monstrosity'],
  harabe: ['undead', 'construct', 'aberration', 'humanoid', 'monstrosity'],
}

export const ENCOUNTER_COMPLICATION = [
  'yaratıklar bir şeyden kaçıyor, saldırmak istemiyor',
  'aralarında yaralı bir esir var',
  'bir tanesi diğerlerine ihanet etmeye hazır',
  'çarpışma zemini çöküyor (her tur DEX save)',
  'yakında uyuyan çok daha büyük bir şey var — gürültü onu uyandırır',
  'yaratıklar aslında pusuya düşmüş, asıl tehdit izliyor',
  'biri bir mesaj taşıyor ve ölürse mesaj kaybolur',
  'ortamda görüşü kesen yoğun bir duman var',
  'yaratıklar bir eşyayı koruyor ve onu bırakıp kaçmaz',
  'üçüncü turda takviye geliyor',
]

export const DUNGEON_PURPOSE = ['mezar', 'hapishane', 'maden', 'tapınak', 'kale', 'laboratuvar', 'sığınak', 'lonca merkezi', 'kütüphane', 'ambar']
export const DUNGEON_BUILDER = ['cüce bir klan', 'unutulmuş bir imparatorluk', 'bir lich', 'bir ejderha kültü', 'doğanın kendisi', 'bir tarikat', 'kaçak köleler', 'bir büyücü loncası']
export const DUNGEON_STATE = ['terk edilmiş ve çökmekte', 'yeniden işgal edilmiş', 'hâlâ tam işler durumda', 'su altında kalmış', 'yarısı gömülmüş', 'büyüyle mühürlenmiş', 'yağmalanmış ve boş']

export const TRAP_TRIGGER = ['basınç plakası', 'gerilmiş tel', 'kapı kolu', 'sandık kilidi', 'yanlış basamak', 'bir kitabın çekilmesi', 'ışık düşmesi', 'ses']
export const TRAP_EFFECT = [
  'zehirli iğne (DC 13 CON, 2d10 poison)',
  'çukur (20 ft düşüş, 2d6 bludgeoning)',
  'ok yağmuru (DC 14 DEX, 3d6 piercing)',
  'alev püskürtücü (DC 15 DEX, 4d6 fire)',
  'düşen kafes (DC 13 DEX veya restrained)',
  'gaz odası (DC 14 CON veya poisoned, 1 saat)',
  'giyotin bıçak (+8 to hit, 4d10 slashing)',
  'alarm çanı (2d4 turda takviye)',
]
