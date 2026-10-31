#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AutoCAD malzeme listesini (katalog-veri.bin → Excel) ortak kataloğa çevirir: ortak/katalog/kalemler.json (sürüm 2).

Kullanım:
    python3 -I araclar/katalog-aktar.py <katalog-veri.bin ya da .xlsx> [ortak/katalog/kalemler.json]

- .bin dosyası baytları 1 ile XOR'lanmış bir .xlsx'tir; çözülüp openpyxl ile okunur.
- Sayfalar: `malzemelistesi` (cins, tip, poz no, temini, önem sırası, metrik ağırlık, kablo kesit, güç, ölçü
  birimleri, standart karakteristik, unsur şehir, unsur köy/bakım), `Sayfa3` (ANA_MALZEMELER: nesnenin kendi
  pozu olan cinsler; hat cinsleri), `Sayfa1` (durum, karakteristik ve unsur kod listeleri).
- Var olan kalemler.json'daki kullanım sayıları, nesne listeleri ve görülen durumlar korunur (gerçek çizimden
  çıkarılmıştı); AutoCAD listesinde olmayan eski kalemler de bırakılır (kaynak: "cizim").
- Birim fiyatlar alınmaz (dağıtılan dosyada sıfırdır; kullanıcı girer).
"""
import json
import os
import re
import sys
import unicodedata
from collections import OrderedDict

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("openpyxl gerekli: pip install openpyxl")

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Nesnenin kendi pozu olan cinsler → eklentideki eleman türü (Sayfa3 ANA_MALZEMELER + AutoCAD'in STANDART katmanındaki
# ek mufu ve kofra). Sıra: menüde görünme sırası.
ANA_TURLERI = OrderedDict([
    ("AG_DIREK", ["AG_DEMİR_GLV", "AG_DEMİR", "AG_BETON", "AG_AĞAÇ"]),
    ("MUSTEREK_DIREK", ["MÜŞ_DEMİR_GLV", "MÜŞ_DEMİR", "MÜŞ_BETON"]),
    ("ENH_DIREK", ["ENH_DEMİR_GLV", "ENH_GLV_CVT", "ENH_DEMİR", "ENH_BETON"]),
    ("AYD_DIREK", ["AYD_GLV_PLG", "AYD_BETON"]),
    ("TRAFO_DIREGI", ["TR_DİREK_GLV", "TR_DİREK"]),
    ("TRAFO_MERKEZI", ["BETON_KÖŞKLER", "TRAFO_BİNASI"]),
    ("PANO", ["AG_PANO_HT", "AG_PANO_DT"]),
    ("BOX", ["BOX_PANO"]),
    ("EK_MUFU", ["EK_MUFU_AG_ALM", "EK_MUFU_AG_BAKIR", "EK_MUFU_OG_ALM", "EK_MUFU_OG_BAKIR"]),
    ("KOFRE", ["KOFRE"]),
    # Telefondaki armatür nesnesi (luminaire → DIGER / ARMATÜR); AutoCAD'de direğin malzemesidir, rolü malzeme kalır
    ("DIGER", ["ARMATÜR"]),
])

# Hat türü → iletken / kablo cinsleri (Sayfa3 B sütunundaki hat cinsleri; sıra: en olağan önce).
HAT_TURLERI = OrderedDict([
    ("AG_HAVAI", ["AG_İLETKEN", "ALPEK_KABLOLAR"]),
    ("AG_YERALTI", ["AG_ALÜMİNYUM_KABLO", "AG_BAKIR_KABLO"]),
    ("AYDINLATMA", ["AYDINLATMA_KABLO", "AG_İLETKEN", "ALPEK_KABLOLAR"]),
    ("OG_HAVAI", ["OG_İLETKEN"]),
    ("OG_YERALTI", ["OG_ALÜMİNYUM_KABLO", "OG_BAKIR_KABLO"]),
    ("REKORTMAN", ["REKORTMAN_ALÜMİNYUM", "REKORTMAN_BAKIR"]),
    ("MUSTEREK", ["AG_İLETKEN", "ALPEK_KABLOLAR", "OG_İLETKEN"]),
])
HAT_CINSLERI = ["AG_İLETKEN", "OG_İLETKEN", "ALPEK_KABLOLAR", "AG_ALÜMİNYUM_KABLO", "AG_BAKIR_KABLO", "AYDINLATMA_KABLO",
                "OG_ALÜMİNYUM_KABLO", "OG_BAKIR_KABLO", "REKORTMAN_ALÜMİNYUM", "REKORTMAN_BAKIR", "TOP_İLETKEN"]
KANAL_CINSI = "KABLO_KANALI"
SONDAJ_CINSI = "YATAY_DELGİ"

# Cins kodlarındaki yazım hataları (31.10.2026): eski kod → yeni kod. Listeden ve eski katalogdan okunan kod çevrilir;
# çıktıya eskiCinsler olarak da yazılır (eklenti ve telefon eski kodu okurken yenisine çevirir).
CINS_DUZELTME = OrderedDict([
    ("AG_ALİMİNYUM_KABLO", "AG_ALÜMİNYUM_KABLO"),
    ("OG_ALİMİNYUM_KABLO", "OG_ALÜMİNYUM_KABLO"),
    ("REKORTMAN_ALİMİNYUM", "REKORTMAN_ALÜMİNYUM"),
    ("ALİMİNYUM_BAĞ_TELİ", "ALÜMİNYUM_BAĞ_TELİ"),
    ("TECHİZAT_MONTAJ_DEMİRİ", "TEÇHİZAT_MONTAJ_DEMİRİ"),
    ("KOFRA", "KOFRE"),
])

# Cins adının okunur karşılığı (menü ve listelerde). Listede olmayan cins Türkçe kuralıyla küçük harfe çevrilir.
CINS_ADLARI = {
    "AG_DEMİR_GLV": "AG galvanizli demir direk", "AG_DEMİR": "AG demir direk", "AG_BETON": "AG beton direk",
    "AG_AĞAÇ": "AG ağaç direk", "MÜŞ_DEMİR_GLV": "Müşterek galvanizli demir direk", "MÜŞ_DEMİR": "Müşterek demir direk",
    "MÜŞ_BETON": "Müşterek beton direk", "ENH_DEMİR_GLV": "ENH galvanizli kaynaklı direk", "ENH_GLV_CVT": "ENH galvanizli cıvatalı direk",
    "ENH_DEMİR": "ENH demir direk", "ENH_BETON": "ENH beton direk", "AYD_GLV_PLG": "Galvanizli poligon aydınlatma direği",
    "AYD_BETON": "Beton aydınlatma direği", "TR_DİREK_GLV": "Galvanizli trafo direği", "TR_DİREK": "Trafo direği",
    "BETON_KÖŞKLER": "Beton / prefabrik köşk", "TRAFO_BİNASI": "Trafo binası", "AG_PANO_HT": "AG pano (harici tip)",
    "AG_PANO_DT": "AG pano (dahili tip)", "BOX_PANO": "Box / SDK", "EK_MUFU_AG_ALM": "AG ek mufu (alüminyum)",
    "EK_MUFU_AG_BAKIR": "AG ek mufu (bakır)", "EK_MUFU_OG_ALM": "OG ek mufu (alüminyum)", "EK_MUFU_OG_BAKIR": "OG ek mufu (bakır)",
    "KOFRE": "Kofre", "ARMATÜR": "Armatür", "AG_İLETKEN": "AG çıplak iletken",
    "OG_İLETKEN": "OG çıplak iletken", "ALPEK_KABLOLAR": "ALPEK (demetli) kablo", "AG_ALÜMİNYUM_KABLO": "AG alüminyum kablo",
    "AG_BAKIR_KABLO": "AG bakır kablo", "AYDINLATMA_KABLO": "Aydınlatma kablosu", "OG_ALÜMİNYUM_KABLO": "OG alüminyum kablo",
    "OG_BAKIR_KABLO": "OG bakır kablo", "REKORTMAN_ALÜMİNYUM": "Rekortman (alüminyum)", "REKORTMAN_BAKIR": "Rekortman (bakır)",
    "TOP_İLETKEN": "Topraklama iletkeni", "KABLO_KANALI": "Kablo kanalı (zemin)", "YATAY_DELGİ": "Yatay sondaj (delgi)",
    "BAKIR_BARA": "Bakır bara", "TRAVERS_VE_KONSOLLAR": "Travers ve konsollar", "TRAVERS_VE_KONSOLLAR_GLV": "Galvanizli travers ve konsollar",
    "BAHH_DEMİR_TRAVERS": "BAHH demir travers", "BAHH_DEMİR_TRAVERS_GLV": "BAHH galvanizli demir travers", "AG_BETON_TRAVERS": "AG beton travers",
    "BAHH_BETON_TRAVERS": "BAHH beton travers", "GALVANİZLİ_GAZ_BORUSU": "Galvanizli gaz borusu", "GALVANİZLİ_KABLO_TAVASI": "Galvanizli kablo tavası",
    "AG_İZOLATÖR": "AG izolatör", "OG_İZOLATÖR": "OG izolatör", "KOMPOZİT_SİLİKON_ASKI_VE_GERGİ_İZOLATÖRLERİ": "Kompozit silikon askı ve gergi izolatörleri",
    "KESİCİLER": "Kesiciler", "PARAFUDR": "Parafudr", "AYIRICI_DT": "Ayırıcı (dahili tip)",
    "AYIRICI_HT": "Ayırıcı (harici tip)", "SİGORTA_BUŞONU": "Sigorta buşonu", "HÜCRELER_METAL": "Metal hücreler",
    "AKÜ_REDRESÖR_GRUBU": "Akü redresör grubu", "TEHLİKE_LEVHASI": "Tehlike levhası", "TOPRAKLAMA": "Topraklama",
    "AKIM_TRAFOLARI": "Akım trafoları", "GERİLİM_TRAFOLARI": "Gerilim trafoları", "TRAFO_GENLEŞME_TANKLI": "Trafo (genleşme tanklı)",
    "TRAFO_HERMETİK": "Trafo (hermetik)", "TRAFO_KURU_TİP": "Trafo (kuru tip)", "OG_KABLO_BAŞLIK_HT_CU": "OG kablo başlığı (harici tip, bakır)",
    "OG_KABLO_BAŞLIK_HT_ALM": "OG kablo başlığı (harici tip, alüminyum)", "OG_KABLO_BAŞLIK_DT_CU": "OG kablo başlığı (dahili tip, bakır)", "OG_KABLO_BAŞLIK_DT_ALM": "OG kablo başlığı (dahili tip, alüminyum)",
    "AG_KABLO_BAŞLIK_CU": "AG kablo başlığı (bakır)", "AG_KABLO_BAŞLIK_ALM": "AG kablo başlığı (alüminyum)", "KABLO_MUHAFAZA_BORULARI": "Kablo muhafaza boruları",
    "EK_YAPIM_İŞLERİ": "Ek yapım işleri", "TUTANAKLI_İŞLER": "Tutanaklı işler", "ENH_YAPIM_İŞLERİ": "ENH yapım işleri",
    "KOMPANZASYON_SİSTEMİ": "Kompanzasyon sistemi", "İNDİRİCİ_VE_AYIRICI_MERKEZ_PANOLARI": "İndirici ve ayırıcı merkez panoları", "DİĞER_AMBAR_MALZEMELERİ": "Diğer ambar malzemeleri",
    "OG_İZOLASYON_MALZEMELERİ": "OG izolasyon malzemeleri", "DEMİR_DİREK_VE_TRAVERS_BOYANMASI": "Demir direk ve travers boyanması", "YAĞMURLUK_BETONU_YAPILMASI": "Yağmurluk betonu yapılması",
    "ALÜMİNYUM_BAĞ_TELİ": "Alüminyum bağ teli", "EK_MANŞONLARI": "Ek manşonları", "ALPEK_KABLO_AKSESUARLARI": "ALPEK kablo aksesuarları",
    "ŞEFFAF_TÜP_AMPULLER": "Şeffaf tüp ampuller", "İZOLATÖR_DEMİRLERİ": "İzolatör demirleri", "ANAHTARLI_OTOMATİK_SİGORTA": "Anahtarlı otomatik sigorta",
    "BAKLAVALI_SAC": "Baklavalı sac", "TEL_KAFESLİ_KAPI": "Tel kafesli kapı", "TEL_KAFESLİ_ÇİT": "Tel kafesli çit",
    "TEÇHİZAT_MONTAJ_DEMİRİ": "Teçhizat montaj demiri", "YOL_KAPLAMASI_SÖKÜMÜ_VE_YAPIMI": "Yol kaplaması sökümü ve yapımı", "KİLOMETRİK_BAKIM_İŞLERİ": "Kilometrik bakım işleri",
}


def cins_kodu(c):
    """Listeden ya da eski katalogdan okunan cins kodu: yazım hatası düzeltilmiş hâli."""
    return CINS_DUZELTME.get(c, c)


def okunur_ad(c):
    """Listede adı olmayan cinsin okunur adı: alt çizgiler boşluk, ilk harf büyük, gerisi Türkçe kuralıyla küçük (İ → i, I → ı)."""
    t = c.replace("_", " ").replace("İ", "i").replace("I", "ı").lower()
    return t[:1].replace("i", "İ").replace("ı", "I").upper() + t[1:] if t else t




# Listeden gelen kalem adlarında geçmemesi gereken kurum adları ve yerlerine yazılacaklar.
# Ad, kaynak kodda yazılmasın diye bayt dizisinden açılır.
YASAK_ADLAR = [(bytes([75, 67, 69, 84, 65, 197, 158, 32, 84, 196, 176, 80, 196, 176]).decode('utf-8'), 'ÖZEL TİP')]

def xlsx_yolu(girdi):
    with open(girdi, "rb") as f:
        veri = f.read()
    if veri[:2] == b"PK":
        return girdi
    cozuk = bytes(b ^ 1 for b in veri)
    if cozuk[:2] != b"PK":
        sys.exit("Dosya ne .xlsx ne de XOR'lu .bin: " + girdi)
    yol = girdi + ".xlsx"
    with open(yol, "wb") as f:
        f.write(cozuk)
    return yol


def temiz(s):
    if s is None:
        return ""
    s = str(s).replace("\xa0", " ")
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"\s+", " ", s).strip()


def kod2(v):
    if v is None or v == "":
        return ""
    s = temiz(v)
    if re.fullmatch(r"\d+(\.0)?", s):
        s = str(int(float(s)))
    return s.zfill(2)


def sayi(v, varsayilan=None):
    if v is None or v == "":
        return varsayilan
    try:
        return float(v)
    except (TypeError, ValueError):
        return varsayilan


def rol_bul(cins):
    for tur, cinsler in ANA_TURLERI.items():
        if cins in cinsler and tur != "DIGER":
            return "ana"
    if cins in HAT_CINSLERI:
        return "hat"
    if cins == KANAL_CINSI:
        return "kanal"
    if cins == SONDAJ_CINSI:
        return "sondaj"
    return "malzeme"


def kod_listeleri(wb):
    """Sayfa1: durum kodları, karakteristikler, unsurlar."""
    ws = wb["Sayfa1"]
    satirlar = list(ws.iter_rows(values_only=True))
    durumlar = OrderedDict()
    for r in satirlar[1:]:
        if r[1]:
            durumlar[temiz(r[1])] = temiz(r[2])
    karakteristikler, unsurlar = OrderedDict(), OrderedDict()
    hedef = karakteristikler
    for r in satirlar[1:]:
        if r[4] == "UNSURLAR":
            hedef = unsurlar
            continue
        if r[6] is not None and r[5]:
            hedef[kod2(r[6])] = temiz(r[5])
    karakteristikler.setdefault("01", "ŞEBEKE YATIRIMLARI")
    return durumlar, karakteristikler, unsurlar


def ana_malzemeler(wb):
    """Sayfa3 A sütunu: AutoCAD'in nesnenin kendi pozu saydığı cinsler (doğrulama için)."""
    ws = wb["Sayfa3"]
    cinsler = []
    for r in ws.iter_rows(values_only=True):
        if r[0] and r[0] != "ANA_MALZEMELER":
            cinsler.append(cins_kodu(temiz(r[0])))
    return cinsler


def malzeme_listesi(wb):
    ws = wb["malzemelistesi"]
    satirlar = list(ws.iter_rows(values_only=True))
    kalemler = OrderedDict()
    cins_onem = OrderedDict()
    for r in satirlar[1:]:
        cins = cins_kodu(temiz(r[1]))
        if not cins:
            continue
        if r[2] is None:
            # cins başlık satırı: önem sırası cinsin sırasıdır
            cins_onem.setdefault(cins, sayi(r[5], 0))
            continue
        # Tip adı olduğu gibi kalır (sondaki boşluk / bölünmez boşluk dahil): AutoCAD çizime bu yazımı yazar,
        # eşleşme birebir olmalı. Karşılaştırmalarda boşluk farkını iki taraf da yok sayar.
        tanim = str(r[2]) if not isinstance(r[2], float) or r[2] != int(r[2]) else str(int(r[2]))
        if not tanim.strip():
            continue
        # Kurum / firma adları kalem adına yazılmaz (kullanıcı isteği, 18.10.2026)
        for ad, yerine in YASAK_ADLAR:
            tanim = tanim.replace(ad, yerine)
        anahtar = (cins, tanim)
        if anahtar in kalemler:
            continue  # listede yinelenen satırlar birebir aynıdır
        birim_giris, birim_rapor = temiz(r[14]), temiz(r[15])
        if not birim_giris:
            birim_giris = "ad/ad"
        if "/" not in birim_giris:
            birim_giris = birim_giris + "/" + (birim_rapor or birim_giris)
        katsayi = sayi(r[6], 1) or 1
        k = OrderedDict()
        k["cins"] = cins
        k["tanim"] = tanim
        k["birim"] = birim_giris
        k["katsayi"] = round(katsayi, 6)
        kar, sehir, koy = kod2(r[16]), kod2(r[17]), kod2(r[18])
        k["tarife"] = (kar + sehir) if kar and sehir else ""
        if koy:
            k["unsurKoy"] = koy
        poz = temiz(r[3])
        if poz:
            k["pozNo"] = poz
        onem = sayi(r[5])
        if onem is not None:
            k["onem"] = int(onem)
        if temiz(r[4]):
            k["temini"] = temiz(r[4])
        if temiz(r[12]):
            k["kesit"] = temiz(r[12])
        guc = sayi(r[13])
        if guc:
            k["guc"] = int(guc) if guc == int(guc) else guc
        k["rol"] = rol_bul(cins)
        kalemler[anahtar] = k
    return kalemler, cins_onem


def eski_katalog(yol):
    if not os.path.exists(yol):
        return {}
    with open(yol, encoding="utf-8") as f:
        eski = json.load(f)
    return OrderedDict(((cins_kodu(it["cins"]), it["tanim"]), it) for it in eski.get("kalemler", []))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    girdi = sys.argv[1]
    hedef = sys.argv[2] if len(sys.argv) > 2 else os.path.join(KOK, "ortak", "katalog", "kalemler.json")
    wb = openpyxl.load_workbook(xlsx_yolu(girdi), read_only=True, data_only=True)
    durumlar, karakteristikler, unsurlar = kod_listeleri(wb)
    ana = ana_malzemeler(wb)
    kalemler, cins_onem = malzeme_listesi(wb)
    eski = eski_katalog(hedef)

    eksik_ana = [c for c in ana if c not in [x for l in ANA_TURLERI.values() for x in l]]
    if eksik_ana:
        print("Uyarı: ANA_MALZEMELER'de olup türe bağlanmayan cinsler:", ", ".join(eksik_ana), file=sys.stderr)

    # Eski katalogdaki kullanım bilgisi aktarılır; AutoCAD listesinde olmayan eski kalemler eklenir
    eklenen_eski = 0
    for anahtar, it in eski.items():
        k = kalemler.get(anahtar)
        if k is None:
            k = OrderedDict()
            k["cins"], k["tanim"] = anahtar
            k["birim"] = it.get("birim", "ad/ad")
            k["katsayi"] = it.get("katsayi", 1)
            k["tarife"] = it.get("tarife", "")
            k["rol"] = it.get("rol") or rol_bul(anahtar[0])
            k["kaynak"] = "cizim"
            kalemler[anahtar] = k
            eklenen_eski += 1
        if it.get("durumlar"):
            k["durumlar"] = it["durumlar"]
        if it.get("nesneler"):
            k["nesneler"] = it["nesneler"]
        if it.get("kullanim"):
            k["kullanim"] = it["kullanim"]

    # Cins listesi (menü sırası: ana türler, hatlar, kanal, sondaj, sonra AutoCAD sırasıyla diğerleri)
    cinsler = OrderedDict()
    for cinsListesi in list(ANA_TURLERI.values()) + list(HAT_TURLERI.values()) + [[KANAL_CINSI, SONDAJ_CINSI]]:
        for c in cinsListesi:
            cinsler.setdefault(c, None)
    for (c, _t) in kalemler:
        cinsler.setdefault(c, None)
    cins_kayitlari = []
    for c in cinsler:
        ad = CINS_ADLARI.get(c) or okunur_ad(c)
        tipler = [k for (cc, _t), k in kalemler.items() if cc == c]
        kayit = OrderedDict([("cins", c), ("ad", ad), ("rol", rol_bul(c)), ("tip", len(tipler))])
        if c in cins_onem:
            kayit["onem"] = int(cins_onem[c])
        cins_kayitlari.append(kayit)

    sira = {c: i for i, c in enumerate(cinsler)}
    liste = sorted(kalemler.values(), key=lambda k: (sira.get(k["cins"], 9999), k.get("onem", 10 ** 9), k["tanim"]))

    cikti = OrderedDict()
    cikti["bicim"] = "sebeke-hakedis.kalem-katalogu"
    cikti["surum"] = 2
    cikti["kaynak"] = "Ortak malzeme listesi (2021, tam) + gerçek bir çizimdeki kullanım sayıları"
    cikti["aciklama"] = ("cins+tanim+birim başına bir kalem. katsayi: giriş biriminden rapor birimine çarpan (ör. kg/m, kg/ad). "
                         "rol: ana (nesnenin kendi pozu), malzeme, hat, kanal, sondaj. tarife: karakteristik (2 hane) + şehir/yatırım unsuru (2 hane); "
                         "unsurKoy: köy/bakım unsuru (çizim ayarı 'köy' ise tarife = karakteristik + unsurKoy). pozNo: TEDAŞ poz numarası. "
                         "onem: AutoCAD rapor sırası. kesit/guc: kablo kesiti, trafo gücü (kVA). temini: AutoCAD temin işareti (T). "
                         "nesneler/kullanim/durumlar: gerçek bir çizimde hangi nesnelerde kaç kez görüldü. "
                         "Üretici: araclar/katalog-aktar.py — elle düzenlenmez.")
    cikti["eskiCinsler"] = OrderedDict([("aciklama", "Yazım hatası düzeltilen cins kodları (31.10.2026): eski kod → yeni kod. "
                                         "Eklenti ve telefon eski kodu okurken yenisine çevirir; yazarken hep yenisini yazar.")] + list(CINS_DUZELTME.items()))
    cikti["durumlar"] = durumlar
    cikti["tarife"] = OrderedDict([
        ("aciklama", "Tarife = karakteristik + unsur. Katalogdaki 'tarife' şehir (yatırım) unsuruyla, 'unsurKoy' köy/bakım sütunuyla üretilir."),
        ("karakteristikler", karakteristikler),
        ("unsurlar", unsurlar),
    ])
    cikti["gruplar"] = OrderedDict([
        ("aciklama", "Nesne türü → cins listeleri (menü ve pencere süzgeçleri bu tabloya göre). Çizimde geçen başka cinsler de seçilebilir."),
        ("elemanlar", ANA_TURLERI),
        ("hatlar", HAT_TURLERI),
        ("kanal", [KANAL_CINSI]),
        ("sondaj", [SONDAJ_CINSI]),
    ])
    cikti["cinsler"] = cins_kayitlari
    cikti["kalemler"] = liste

    with open(hedef, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("%s: %d kalem, %d cins (%d eski kalem korundu, AutoCAD'de olmayan)" % (os.path.relpath(hedef, KOK), len(liste), len(cins_kayitlari), eklenen_eski))


if __name__ == "__main__":
    main()
