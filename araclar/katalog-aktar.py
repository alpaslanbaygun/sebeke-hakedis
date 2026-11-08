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
  çıkarılmıştı); AutoCAD listesinde olmayan eski kalemler de bırakılır (kaynak: "cizim"); birim fiyat kitabından elle
  eklenen kalemler (kaynak: "ek") bütün alanlarıyla korunur.
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

# Cins adının okunur karşılığı (şerit, pencereler ve listeler). Kullanıcı kuralı (8.11.2026): alt çizgisiz, her sözcüğün
# ilk harfi büyük ("AG Galvaniz Demir Direk"); AG / OG / ENH / BAHH / ALPEK gibi kısaltmalar büyük, "ve" küçük.
# Listede olmayan cins okunur_ad ile aynı kurala göre çevrilir. Raporlarda ve dosyalarda kodun kendisi yazılır.
CINS_ADLARI = {
    "AG_DEMİR_GLV": "AG Galvaniz Demir Direk", "AG_DEMİR": "AG Demir Direk", "AG_BETON": "AG Beton Direk",
    "AG_AĞAÇ": "AG Ağaç Direk", "MÜŞ_DEMİR_GLV": "Müşterek Galvaniz Demir Direk", "MÜŞ_DEMİR": "Müşterek Demir Direk",
    "MÜŞ_BETON": "Müşterek Beton Direk", "ENH_DEMİR_GLV": "ENH Galvaniz Kaynaklı Direk", "ENH_GLV_CVT": "ENH Galvaniz Cıvatalı Direk",
    "ENH_DEMİR": "ENH Demir Direk", "ENH_BETON": "ENH Beton Direk", "AYD_GLV_PLG": "Galvaniz Poligon Aydınlatma Direği",
    "AYD_BETON": "Beton Aydınlatma Direği", "TR_DİREK_GLV": "Galvaniz Trafo Direği", "TR_DİREK": "Trafo Direği",
    "BETON_KÖŞKLER": "Beton Köşk", "TRAFO_BİNASI": "Trafo Binası", "AG_PANO_HT": "AG Pano (Harici Tip)",
    "AG_PANO_DT": "AG Pano (Dahili Tip)", "BOX_PANO": "Box Pano (SDK)", "EK_MUFU_AG_ALM": "AG Ek Mufu (Alüminyum)",
    "EK_MUFU_AG_BAKIR": "AG Ek Mufu (Bakır)", "EK_MUFU_OG_ALM": "OG Ek Mufu (Alüminyum)", "EK_MUFU_OG_BAKIR": "OG Ek Mufu (Bakır)",
    "KOFRE": "Kofre", "ARMATÜR": "Armatür", "AG_İLETKEN": "AG İletken",
    "OG_İLETKEN": "OG İletken", "ALPEK_KABLOLAR": "ALPEK Kablolar", "AG_ALÜMİNYUM_KABLO": "AG Alüminyum Kablo",
    "AG_BAKIR_KABLO": "AG Bakır Kablo", "AYDINLATMA_KABLO": "Aydınlatma Kablosu", "OG_ALÜMİNYUM_KABLO": "OG Alüminyum Kablo",
    "OG_BAKIR_KABLO": "OG Bakır Kablo", "REKORTMAN_ALÜMİNYUM": "Rekortman Alüminyum", "REKORTMAN_BAKIR": "Rekortman Bakır",
    "TOP_İLETKEN": "Topraklama İletkeni", "KABLO_KANALI": "Kablo Kanalı", "YATAY_DELGİ": "Yatay Delgi (Sondaj)",
    "BAKIR_BARA": "Bakır Bara", "TRAVERS_VE_KONSOLLAR": "Travers ve Konsollar", "TRAVERS_VE_KONSOLLAR_GLV": "Galvaniz Travers ve Konsollar",
    "BAHH_DEMİR_TRAVERS": "BAHH Demir Travers", "BAHH_DEMİR_TRAVERS_GLV": "BAHH Galvaniz Demir Travers", "AG_BETON_TRAVERS": "AG Beton Travers",
    "BAHH_BETON_TRAVERS": "BAHH Beton Travers", "GALVANİZLİ_GAZ_BORUSU": "Galvanizli Gaz Borusu", "GALVANİZLİ_KABLO_TAVASI": "Galvanizli Kablo Tavası",
    "AG_İZOLATÖR": "AG İzolatör", "OG_İZOLATÖR": "OG İzolatör", "KOMPOZİT_SİLİKON_ASKI_VE_GERGİ_İZOLATÖRLERİ": "Kompozit Silikon Askı ve Gergi İzolatörleri",
    "KESİCİLER": "Kesiciler", "PARAFUDR": "Parafudr", "AYIRICI_DT": "Ayırıcı (Dahili Tip)",
    "AYIRICI_HT": "Ayırıcı (Harici Tip)", "SİGORTA_BUŞONU": "Sigorta Buşonu", "HÜCRELER_METAL": "Metal Hücreler",
    "AKÜ_REDRESÖR_GRUBU": "Akü Redresör Grubu", "TEHLİKE_LEVHASI": "Tehlike Levhası", "TOPRAKLAMA": "Topraklama",
    "AKIM_TRAFOLARI": "Akım Trafoları", "GERİLİM_TRAFOLARI": "Gerilim Trafoları", "TRAFO_GENLEŞME_TANKLI": "Trafo (Genleşme Tanklı)",
    "TRAFO_HERMETİK": "Trafo (Hermetik)", "TRAFO_KURU_TİP": "Trafo (Kuru Tip)", "OG_KABLO_BAŞLIK_HT_CU": "OG Kablo Başlığı (Harici Tip, Bakır)",
    "OG_KABLO_BAŞLIK_HT_ALM": "OG Kablo Başlığı (Harici Tip, Alüminyum)", "OG_KABLO_BAŞLIK_DT_CU": "OG Kablo Başlığı (Dahili Tip, Bakır)", "OG_KABLO_BAŞLIK_DT_ALM": "OG Kablo Başlığı (Dahili Tip, Alüminyum)",
    "AG_KABLO_BAŞLIK_CU": "AG Kablo Başlığı (Bakır)", "AG_KABLO_BAŞLIK_ALM": "AG Kablo Başlığı (Alüminyum)", "KABLO_MUHAFAZA_BORULARI": "Kablo Muhafaza Boruları",
    "EK_YAPIM_İŞLERİ": "Ek Yapım İşleri", "TUTANAKLI_İŞLER": "Tutanaklı İşler", "ENH_YAPIM_İŞLERİ": "ENH Yapım İşleri",
    "KOMPANZASYON_SİSTEMİ": "Kompanzasyon Sistemi", "İNDİRİCİ_VE_AYIRICI_MERKEZ_PANOLARI": "İndirici ve Ayırıcı Merkez Panoları", "DİĞER_AMBAR_MALZEMELERİ": "Diğer Ambar Malzemeleri",
    "OG_İZOLASYON_MALZEMELERİ": "OG İzolasyon Malzemeleri", "DEMİR_DİREK_VE_TRAVERS_BOYANMASI": "Demir Direk ve Travers Boyanması", "YAĞMURLUK_BETONU_YAPILMASI": "Yağmurluk Betonu Yapılması",
    "ALÜMİNYUM_BAĞ_TELİ": "Alüminyum Bağ Teli", "EK_MANŞONLARI": "Ek Manşonları", "ALPEK_KABLO_AKSESUARLARI": "ALPEK Kablo Aksesuarları",
    "ŞEFFAF_TÜP_AMPULLER": "Şeffaf Tüp Ampuller", "İZOLATÖR_DEMİRLERİ": "İzolatör Demirleri", "ANAHTARLI_OTOMATİK_SİGORTA": "Anahtarlı Otomatik Sigorta",
    "BAKLAVALI_SAC": "Baklavalı Sac", "TEL_KAFESLİ_KAPI": "Tel Kafesli Kapı", "TEL_KAFESLİ_ÇİT": "Tel Kafesli Çit",
    "TEÇHİZAT_MONTAJ_DEMİRİ": "Teçhizat Montaj Demiri", "YOL_KAPLAMASI_SÖKÜMÜ_VE_YAPIMI": "Yol Kaplaması Sökümü ve Yapımı", "KİLOMETRİK_BAKIM_İŞLERİ": "Kilometrik Bakım İşleri",
}

# Okunur adda büyük kalan kısaltmalar (listede olmayan cinsler için).
KISALTMALAR = {"AG", "OG", "ENH", "BAHH", "ALPEK", "SDK", "XLPE", "NYY", "NAYY", "GLV", "CVT", "PLG", "HT", "DT", "CU", "ALM", "TR"}
KUCUK_SOZCUKLER = {"ve", "ile", "veya"}


def cins_kodu(c):
    """Listeden ya da eski katalogdan okunan cins kodu: yazım hatası düzeltilmiş hâli."""
    return CINS_DUZELTME.get(c, c)


def okunur_ad(c):
    """Listede adı olmayan cinsin okunur adı: alt çizgiler boşluk, her sözcüğün ilk harfi büyük, gerisi Türkçe kuralıyla
    küçük (İ → i, I → ı); kısaltmalar (AG, OG, ENH…) büyük, "ve" küçük kalır."""
    out = []
    for w in c.replace("_", " ").split():
        if w in KISALTMALAR:
            out.append(w)
            continue
        k = w.replace("İ", "i").replace("I", "ı").lower()
        if k in KUCUK_SOZCUKLER:
            out.append(k)
            continue
        ilk = k[:1].replace("i", "İ").replace("ı", "I").upper()
        out.append(ilk + k[1:])
    return " ".join(out)


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
        if k is None and it.get("kaynak") == "ek":
            # Birim fiyat kitabından elle eklenmiş kalem (AG galvaniz travers ve konsollar…): bütün alanlarıyla korunur
            kalemler[anahtar] = OrderedDict(it)
            eklenen_eski += 1
            continue
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
