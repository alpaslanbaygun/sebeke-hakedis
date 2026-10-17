#!/usr/bin/env python3
"""PROMAGIS ana malzeme listesinden ortak katalog (ortak/katalog/kalemler.json, sürüm 2) üretir.

Kullanım:
    python3 araclar/promagis-katalog.py <promagis2021.bin | malzeme.xlsx> [ortak/katalog/kalemler.json]

- `promagis2021.bin` PROMAGIS kurulumunun Support klasöründedir: her baytı 1 ile XOR'lanmış bir .xlsx'tir.
  Dosyanın kendisi depoya konmaz (üçüncü taraf yazılım); yalnız bu araçla türetilen tablo tutulur.
- Var olan kalemler.json'daki kullanım sayıları (gerçek çizimden) ve ana listede olmayan kalemler korunur.
- Birim fiyat sütunları alınmaz (dağıtılan dosyada boştur; fiyat girişi ayrı konu).
Bağımlılık: openpyxl (pip install openpyxl).
"""
import json
import os
import re
import sys
import tempfile
import collections

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("openpyxl gerekli: pip install openpyxl")

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Eleman / hat türü → bu türde seçilebilecek cinsler (PROMAGIS ANA_MALZEMELER ve HAT_CINS listeleri)
TUR_CINSLERI = collections.OrderedDict([
    ("AG_DIREK", ["AG_BETON", "AG_DEMİR_GLV", "AG_DEMİR", "AG_AĞAÇ"]),
    ("MUSTEREK_DIREK", ["MÜŞ_BETON", "MÜŞ_DEMİR_GLV", "MÜŞ_DEMİR"]),
    ("ENH_DIREK", ["ENH_BETON", "ENH_DEMİR_GLV", "ENH_GLV_CVT", "ENH_DEMİR"]),
    ("AYD_DIREK", ["AYD_GLV_PLG", "AYD_BETON"]),
    ("TRAFO_DIREGI", ["TR_DİREK_GLV", "TR_DİREK"]),
    ("TRAFO_MERKEZI", ["BETON_KÖŞKLER", "TRAFO_BİNASI"]),
    ("PANO", ["AG_PANO_HT", "AG_PANO_DT"]),
    ("BOX", ["BOX_PANO"]),
    ("EK_MUFU", ["EK_MUFU_AG_ALM", "EK_MUFU_AG_BAKIR", "EK_MUFU_OG_ALM", "EK_MUFU_OG_BAKIR"]),
    ("KOFRE", ["KOFRA"]),
    ("HAT_AG_HAVAI", ["AG_İLETKEN", "ALPEK_KABLOLAR"]),
    ("HAT_AG_YERALTI", ["AG_ALİMİNYUM_KABLO", "AG_BAKIR_KABLO", "TOP_İLETKEN"]),
    ("HAT_OG_HAVAI", ["OG_İLETKEN"]),
    ("HAT_OG_YERALTI", ["OG_ALİMİNYUM_KABLO", "OG_BAKIR_KABLO"]),
    ("HAT_AYDINLATMA", ["AYDINLATMA_KABLO"]),
    ("HAT_REKORTMAN", ["REKORTMAN_ALİMİNYUM", "REKORTMAN_BAKIR"]),
    ("HAT_MUSTEREK", ["AG_İLETKEN", "OG_İLETKEN", "ALPEK_KABLOLAR"]),
    ("KANAL", ["KABLO_KANALI"]),
    ("SONDAJ", ["YATAY_DELGİ", "KABLO_MUHAFAZA_BORULARI", "GALVANİZLİ_KABLO_TAVASI"]),
])
HAT_CINSLERI = ["AG_İLETKEN", "OG_İLETKEN", "ALPEK_KABLOLAR", "AG_ALİMİNYUM_KABLO", "AG_BAKIR_KABLO", "OG_ALİMİNYUM_KABLO",
                "OG_BAKIR_KABLO", "AYDINLATMA_KABLO", "REKORTMAN_ALİMİNYUM", "REKORTMAN_BAKIR", "TOP_İLETKEN", "KİLOMETRİK_BAKIM_İŞLERİ"]
KARAKTERISTIKLER = collections.OrderedDict([
    ("01", "ŞEBEKE YATIRIMLARI"), ("02", "YASAL ZORUNLULUĞU OLAN YATIRIMLAR"), ("03", "ŞEBEKE İŞLETİM SİSTEMİ YATIRIMLARI"),
    ("04", "AR-GE PROJESİ YAYGINLAŞTIRMA YATIRIMLARI"), ("05", "YATIRIM HARCAMASI NİTELİĞİNDEKİ DİĞER HARCAMALAR"),
    ("11", "ŞEBEKE YATIRIMLARI (FİYATA DAHİLLER İÇİN)"),
])
UNSURLAR = collections.OrderedDict([
    ("01", "TRAFO EKİPMAN OG"), ("02", "TRAFO EKİPMAN AG"), ("03", "ENERJİ NAKİL HATTI"), ("04", "ŞEHİR YERALTI OG"),
    ("05", "ŞEHİR YERALTI AG"), ("06", "ŞEHİR HAVAİ OG"), ("07", "ŞEHİR HAVAİ AG"), ("08", "AYDINLATMA"),
    ("09", "REKORTMAN HAVAİ"), ("10", "REKORTMAN YERALTI"), ("11", "BAĞLANTI HATTI AG"), ("12", "BAĞLANTI HATTI OG"),
    ("13", "DİĞER"), ("14", "SAYAÇ"), ("15", "BAKIM-1-2"), ("16", "BAKIM-3"),
])
DURUMLAR = collections.OrderedDict([
    ("M+M", "Malzeme + montaj (yüklenici)"), ("M", "Yalnız montaj (malzeme kurumdan)"),
    ("KM", "Kurum monte eder, malzeme yükleniciye çıkılır"), ("DM+M", "Sök-tak (demontaj + montaj)"),
    ("DM", "Demontaj (KESİK / SÖKÜK)"), ("ENH", "Kilometrik bedelli iş"), ("ME", "Mutabakat eksiği"), ("MEVCUT", "Mevcut (bedelsiz)"),
])
KANAL_OLCULERI = ["20x20x50", "20x20x70", "40x40x60", "40x40x80", "40x40x100", "60x60x60", "60x60x80", "60x60x100", "60x60x120",
                  "80x80x60", "80x80x80", "80x80x100", "80x80x120", "90x90x60", "90x90x80", "90x90x100", "90x90x120"]
GERILIMLER = ["6.3", "15", "17.5", "30", "31.5", "33", "36"]
GUCLER = ["25", "40", "50", "63", "100", "160", "250", "400", "630", "800", "1000", "1250", "1600"]
SIGORTALAR = ["32", "40", "50", "63", "80", "100", "125", "160", "200", "250", "315", "400", "500", "630"]


def temiz(s):
    """Hücre metnini sadeleştirir: bölünmez boşluklar, baştaki / sondaki ve ardışık boşluklar."""
    if s is None:
        return ""
    s = str(s).replace("\xa0", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def anahtar(cins, tanim):
    return cins + "|" + temiz(tanim).lower()


def rol_bul(cins):
    for tur, cinsler in TUR_CINSLERI.items():
        if cins in cinsler:
            if tur == "KANAL":
                return "kanal"
            if tur == "SONDAJ":
                return "sondaj"
            if tur.startswith("HAT_"):
                return "hat"
            return "ana"
    if cins in HAT_CINSLERI:
        return "hat"
    return "malzeme"


def nesneler_bul(cins, rol):
    out = []
    for tur, cinsler in TUR_CINSLERI.items():
        if cins in cinsler:
            out.append(tur)
    return out


def sayi(v, varsayilan=None):
    if v is None or v == "":
        return varsayilan
    try:
        return float(str(v).replace(",", "."))
    except ValueError:
        return varsayilan


def kaynak_calisma_kitabi(yol):
    with open(yol, "rb") as f:
        veri = f.read()
    if veri[:2] != b"PK":
        veri = bytes(b ^ 1 for b in veri)
        if veri[:2] != b"PK":
            sys.exit("Dosya ne .xlsx ne de PROMAGIS .bin: " + yol)
        tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        tmp.write(veri)
        tmp.close()
        return tmp.name
    return yol


def oku(yol):
    wb = openpyxl.load_workbook(kaynak_calisma_kitabi(yol), data_only=True, read_only=True)
    if "malzemelistesi" not in wb.sheetnames:
        sys.exit("'malzemelistesi' sayfası yok")
    ws = wb["malzemelistesi"]
    kalemler = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        r = list(r) + [None] * (23 - len(r))
        cins, tanim = temiz(r[1]), temiz(r[2])
        if not cins or not tanim or tanim == cins:
            continue  # başlık satırı
        krk = temiz(r[16]).zfill(2) if temiz(r[16]) else ""
        sehir = temiz(r[17]).zfill(2) if temiz(r[17]) else ""
        koy = temiz(r[18]).zfill(2) if temiz(r[18]) else ""
        k = collections.OrderedDict()
        k["cins"] = cins
        k["tanim"] = tanim
        poz = temiz(r[3])
        if poz:
            k["poz"] = poz
        k["birim"] = temiz(r[14]) or "ad/ad"
        k["katsayi"] = round(sayi(r[6], 1) or 1, 6)
        k["tarife"] = (krk + sehir) if krk and sehir else ""
        if koy and krk and koy != sehir:
            k["tarifeKoy"] = krk + koy
        kesit = temiz(r[12])
        if kesit and kesit != tanim:
            k["kesit"] = kesit
        guc = temiz(r[13])
        if guc:
            k["guc"] = guc
        onem = sayi(r[5])
        if onem:
            k["onem"] = int(onem)
        temini = temiz(r[4])
        if temini and len(temini) <= 3:
            k["temini"] = temini
        k["rol"] = rol_bul(cins)
        k["nesneler"] = nesneler_bul(cins, k["rol"])
        k["kullanim"] = 0
        kalemler.append(k)
    return kalemler


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    girdi = sys.argv[1]
    hedef = sys.argv[2] if len(sys.argv) > 2 else os.path.join(KOK, "ortak", "katalog", "kalemler.json")
    yeni = oku(girdi)

    # Eski katalog: kullanım sayıları ve ana listede olmayan kalemler korunur
    eski = {}
    if os.path.exists(hedef):
        with open(hedef, encoding="utf-8") as f:
            for k in json.load(f).get("kalemler", []):
                eski[anahtar(k["cins"], k["tanim"])] = k
    gorulen = {}
    sonuc = []
    cift = 0
    for k in yeni:
        a = anahtar(k["cins"], k["tanim"])
        if a in gorulen:
            cift += 1
            continue
        e = eski.get(a)
        if e:
            k["kullanim"] = int(e.get("kullanim", 0) or 0)
            for n in e.get("nesneler", []):
                if n not in k["nesneler"]:
                    k["nesneler"].append(n)
        gorulen[a] = k
        sonuc.append(k)
    eklenen_eski = 0
    for a, e in eski.items():
        if a in gorulen:
            continue
        k = collections.OrderedDict()
        for alan in ("cins", "tanim", "birim", "katsayi", "tarife", "rol", "nesneler", "kullanim"):
            if alan in e:
                k[alan] = e[alan]
        k["kaynak"] = "cizim"
        sonuc.append(k)
        eklenen_eski += 1

    # Önem sırasına (ana listedeki sıra) göre; bilinmeyenler sona
    sonuc.sort(key=lambda k: (k.get("onem", 10 ** 9), k["cins"], k["tanim"]))

    cikti = collections.OrderedDict()
    cikti["bicim"] = "sebeke-hakedis.kalemler"
    cikti["surum"] = 2
    cikti["kaynak"] = "PROMAGIS ana malzeme listesi (araclar/promagis-katalog.py) + gerçek bir çizimdeki kullanım sayıları"
    cikti["aciklama"] = ("cins+tanim başına bir kalem. birim: giriş/rapor (ör. ad/kg). katsayi: giriş biriminden rapor birimine çarpan "
                         "(metrik ağırlık). tarife: karakteristik (2) + unsur (2), şehir; tarifeKoy: köy / bakım sütunu. poz: TEDAŞ poz no. "
                         "rol: ana (nesnenin kendi pozu), hat, kanal, sondaj, malzeme. nesneler: hangi tür için seçilir. kullanim: çizimde görülme sayısı.")
    cikti["turCinsleri"] = TUR_CINSLERI
    cikti["karakteristikler"] = KARAKTERISTIKLER
    cikti["unsurlar"] = UNSURLAR
    cikti["durumlar"] = DURUMLAR
    cikti["kanalOlculeri"] = KANAL_OLCULERI
    cikti["gerilimler"] = GERILIMLER
    cikti["gucler"] = GUCLER
    cikti["sigortalar"] = SIGORTALAR
    cikti["kalemler"] = sonuc
    with open(hedef, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=1)
        f.write("\n")
    cinsler = sorted({k["cins"] for k in sonuc})
    print("yazıldı: %s — %d kalem, %d cins, %d yinelenen atlandı, eski katalogdan korunan %d" % (hedef, len(sonuc), len(cinsler), cift, eklenen_eski))
    roller = collections.Counter(k["rol"] for k in sonuc)
    print("roller:", dict(roller))


if __name__ == "__main__":
    main()
