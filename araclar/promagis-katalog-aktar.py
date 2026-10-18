#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PROMAGIS malzeme listesini (promagis2021.bin → Excel) ortak kataloğa çevirir: ortak/katalog/kalemler.json (sürüm 2).

Kullanım:
    python3 -I araclar/promagis-katalog-aktar.py <promagis2021.bin ya da .xlsx> [ortak/katalog/kalemler.json]

- .bin dosyası baytları 1 ile XOR'lanmış bir .xlsx'tir; çözülüp openpyxl ile okunur.
- Sayfalar: `malzemelistesi` (cins, tip, poz no, temini, önem sırası, metrik ağırlık, kablo kesit, güç, ölçü
  birimleri, standart karakteristik, unsur şehir, unsur köy/bakım), `Sayfa3` (ANA_MALZEMELER: nesnenin kendi
  pozu olan cinsler; hat cinsleri), `Sayfa1` (durum, karakteristik ve unsur kod listeleri).
- Var olan kalemler.json'daki kullanım sayıları, nesne listeleri ve görülen durumlar korunur (gerçek çizimden
  çıkarılmıştı); PROMAGIS listesinde olmayan eski kalemler de bırakılır (kaynak: "cizim").
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

# Nesnenin kendi pozu olan cinsler → eklentideki eleman türü (Sayfa3 ANA_MALZEMELER + PROMAGIS'in STANDART katmanındaki
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
    ("KOFRE", ["KOFRA"]),
    # Telefondaki armatür nesnesi (luminaire → DIGER / ARMATÜR); PROMAGIS'te direğin malzemesidir, rolü malzeme kalır
    ("DIGER", ["ARMATÜR"]),
])

# Hat türü → iletken / kablo cinsleri (Sayfa3 B sütunundaki hat cinsleri; sıra: en olağan önce).
HAT_TURLERI = OrderedDict([
    ("AG_HAVAI", ["AG_İLETKEN", "ALPEK_KABLOLAR"]),
    ("AG_YERALTI", ["AG_ALİMİNYUM_KABLO", "AG_BAKIR_KABLO"]),
    ("AYDINLATMA", ["AYDINLATMA_KABLO", "AG_İLETKEN", "ALPEK_KABLOLAR"]),
    ("OG_HAVAI", ["OG_İLETKEN"]),
    ("OG_YERALTI", ["OG_ALİMİNYUM_KABLO", "OG_BAKIR_KABLO"]),
    ("REKORTMAN", ["REKORTMAN_ALİMİNYUM", "REKORTMAN_BAKIR"]),
    ("MUSTEREK", ["AG_İLETKEN", "ALPEK_KABLOLAR", "OG_İLETKEN"]),
])
HAT_CINSLERI = ["AG_İLETKEN", "OG_İLETKEN", "ALPEK_KABLOLAR", "AG_ALİMİNYUM_KABLO", "AG_BAKIR_KABLO", "AYDINLATMA_KABLO",
                "OG_ALİMİNYUM_KABLO", "OG_BAKIR_KABLO", "REKORTMAN_ALİMİNYUM", "REKORTMAN_BAKIR", "TOP_İLETKEN"]
KANAL_CINSI = "KABLO_KANALI"
SONDAJ_CINSI = "YATAY_DELGİ"

# Cins adının okunur karşılığı (menü ve listelerde). Listede olmayan cins alt çizgisiz yazılır.
CINS_ADLARI = {
    "AG_DEMİR_GLV": "AG galvanizli demir direk", "AG_DEMİR": "AG demir direk", "AG_BETON": "AG beton direk", "AG_AĞAÇ": "AG ağaç direk",
    "MÜŞ_DEMİR_GLV": "Müşterek galvanizli demir direk", "MÜŞ_DEMİR": "Müşterek demir direk", "MÜŞ_BETON": "Müşterek beton direk",
    "ENH_DEMİR_GLV": "ENH galvanizli kaynaklı direk", "ENH_GLV_CVT": "ENH galvanizli cıvatalı direk", "ENH_DEMİR": "ENH demir direk", "ENH_BETON": "ENH beton direk",
    "AYD_GLV_PLG": "Galvanizli poligon aydınlatma direği", "AYD_BETON": "Beton aydınlatma direği",
    "TR_DİREK_GLV": "Galvanizli trafo direği", "TR_DİREK": "Trafo direği",
    "BETON_KÖŞKLER": "Beton / prefabrik köşk", "TRAFO_BİNASI": "Trafo binası",
    "AG_PANO_HT": "AG pano (harici tip)", "AG_PANO_DT": "AG pano (dahili tip)", "BOX_PANO": "Box / SDK",
    "EK_MUFU_AG_ALM": "AG ek mufu (alüminyum)", "EK_MUFU_AG_BAKIR": "AG ek mufu (bakır)", "EK_MUFU_OG_ALM": "OG ek mufu (alüminyum)", "EK_MUFU_OG_BAKIR": "OG ek mufu (bakır)",
    "KOFRA": "Kofre",
    "AG_İLETKEN": "AG çıplak iletken", "OG_İLETKEN": "OG çıplak iletken", "ALPEK_KABLOLAR": "ALPEK (demetli) kablo",
    "AG_ALİMİNYUM_KABLO": "AG alüminyum kablo", "AG_BAKIR_KABLO": "AG bakır kablo", "AYDINLATMA_KABLO": "Aydınlatma kablosu",
    "OG_ALİMİNYUM_KABLO": "OG alüminyum kablo", "OG_BAKIR_KABLO": "OG bakır kablo",
    "REKORTMAN_ALİMİNYUM": "Rekortman (alüminyum)", "REKORTMAN_BAKIR": "Rekortman (bakır)", "TOP_İLETKEN": "Topraklama iletkeni",
    "KABLO_KANALI": "Kablo kanalı (zemin)", "YATAY_DELGİ": "Yatay sondaj (delgi)",
}


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
    """Sayfa3 A sütunu: PROMAGIS'in nesnenin kendi pozu saydığı cinsler (doğrulama için)."""
    ws = wb["Sayfa3"]
    cinsler = []
    for r in ws.iter_rows(values_only=True):
        if r[0] and r[0] != "ANA_MALZEMELER":
            cinsler.append(temiz(r[0]))
    return cinsler


def malzeme_listesi(wb):
    ws = wb["malzemelistesi"]
    satirlar = list(ws.iter_rows(values_only=True))
    kalemler = OrderedDict()
    cins_onem = OrderedDict()
    for r in satirlar[1:]:
        cins = temiz(r[1])
        if not cins:
            continue
        if r[2] is None:
            # cins başlık satırı: önem sırası cinsin sırasıdır
            cins_onem.setdefault(cins, sayi(r[5], 0))
            continue
        # Tip adı olduğu gibi kalır (sondaki boşluk / bölünmez boşluk dahil): PROMAGIS çizime bu yazımı yazar,
        # eşleşme birebir olmalı. Karşılaştırmalarda boşluk farkını iki taraf da yok sayar.
        tanim = str(r[2]) if not isinstance(r[2], float) or r[2] != int(r[2]) else str(int(r[2]))
        if not tanim.strip():
            continue
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
    return OrderedDict(((it["cins"], it["tanim"]), it) for it in eski.get("kalemler", []))


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

    # Eski katalogdaki kullanım bilgisi aktarılır; PROMAGIS listesinde olmayan eski kalemler eklenir
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

    # Cins listesi (menü sırası: ana türler, hatlar, kanal, sondaj, sonra PROMAGIS sırasıyla diğerleri)
    cinsler = OrderedDict()
    for cinsListesi in list(ANA_TURLERI.values()) + list(HAT_TURLERI.values()) + [[KANAL_CINSI, SONDAJ_CINSI]]:
        for c in cinsListesi:
            cinsler.setdefault(c, None)
    for (c, _t) in kalemler:
        cinsler.setdefault(c, None)
    cins_kayitlari = []
    for c in cinsler:
        ad = CINS_ADLARI.get(c) or c.replace("_", " ").capitalize()
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
    cikti["kaynak"] = "PROMAGIS 2021 malzeme listesi (tam) + gerçek bir çizimdeki kullanım sayıları"
    cikti["aciklama"] = ("cins+tanim+birim başına bir kalem. katsayi: giriş biriminden rapor birimine çarpan (ör. kg/m, kg/ad). "
                         "rol: ana (nesnenin kendi pozu), malzeme, hat, kanal, sondaj. tarife: karakteristik (2 hane) + şehir/yatırım unsuru (2 hane); "
                         "unsurKoy: köy/bakım unsuru (çizim ayarı 'köy' ise tarife = karakteristik + unsurKoy). pozNo: TEDAŞ poz numarası. "
                         "onem: PROMAGIS rapor sırası. kesit/guc: kablo kesiti, trafo gücü (kVA). temini: PROMAGIS temin işareti (T). "
                         "nesneler/kullanim/durumlar: gerçek bir çizimde hangi nesnelerde kaç kez görüldü. "
                         "Üretici: araclar/promagis-katalog-aktar.py — elle düzenlenmez.")
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
    print("%s: %d kalem, %d cins (%d eski kalem korundu, PROMAGIS'te olmayan)" % (os.path.relpath(hedef, KOK), len(liste), len(cins_kayitlari), eklenen_eski))


if __name__ == "__main__":
    main()
