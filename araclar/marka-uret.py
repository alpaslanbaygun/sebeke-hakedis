#!/usr/bin/env python3
"""Şebeke-M Hakediş marka dosyalarını kaynak logodan üretir (ortak/marka/kaynak/sebeke-m-hakedis-logo.png → ortak/marka,
telefon, eklenti).

  python3 araclar/marka-uret.py

Kaynak, kullanıcının gönderdiği logodur (8.11.2026). İçindeki "HAKKEDİŞ" yazımı burada "HAKEDİŞ" yapılır (hakedis_duzelt):
ikinci K italik eğimine uyan eğik bir kesimle çıkarılır, sağdaki parça sola kaydırılır ve yazı satırı yeniden ortalanır.
Kaynak düzeltilmiş gelirse (yazı zaten HAKEDİŞ) DUZELT = False yapılır.

Üretilenler:
  ortak/marka/sebeke-m-logo.png        tam logo (amblem + "Şebeke-M / HAKEDİŞ"), beyaz zemin, 720 px genişlik
  ortak/marka/sebeke-m-amblem.png      amblem (yazısız), saydam zemin, 512 × 512
  ortak/marka/sebeke-m-simge.png       uygulama simgesi: beyaz yuvarlak köşeli kare içinde amblem, 512 × 512
  ortak/marka/sebeke-m-simge-16…64.png eklentinin şerit ve pencere rozetleri
  telefon/android/res/mipmap-*/ic_launcher.png      eski Android simgesi (48–192 px)
  telefon/android/res/mipmap-*/ic_launcher_fg.png   uyarlanabilir simgenin ön yüzü (108 dp, güvenli alan 66 dp)
  telefon/web/assets/sebeke-m-logo.png, sebeke-m-amblem.png, sebeke-m-simge.png   uygulama içi (açılış, üst çubuk, hakkında)

Saydamlık: logonun dışındaki beyaz, kenardan dolarak bulunur (amblemin içindeki beyaz yollar ve kenarlar korunur);
kenar pikselleri beyazdan ayrıştırılır (beyaz hare kalmaz, koyu zeminde temiz görünür).
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(KOK, 'ortak/marka/kaynak/sebeke-m-hakedis-logo.png')
MARKA = os.path.join(KOK, 'ortak/marka')

# Kaynak logodaki bölgeler (1448 × 1086): amblem (yazının üstündeki çizim) ve tam logo (beyaz kenar boşluğu kırpılır)
AMBLEM = (290, 60, 1180, 800)
DUZELT = True


def hakedis_duzelt(im):
    """"HAKKEDİŞ" → "HAKEDİŞ": ikinci K'yi eğik kesimle çıkarır, sağı sola kaydırır, yazı satırını ortalar (kaynağa özgü ölçüler)."""
    a = np.asarray(im.convert('RGB')).copy()
    _, w, _ = a.shape
    adim = 66                   # bir K'nin adımı: K1 → K2 ve K2 → E gövdeleri arası (px)
    ust, alt = 800, 971         # yazı satırı: çizimin altı (≤ 798) ile yazının üstü (801) arasındaki boş satırdan
    k2 = lambda y: 1102 - (y - 838) * (12 / 72)   # ikinci K'nin gövdesinin sol kenarı (italik eğim 1/6)
    out = a.copy()
    for y in range(ust, alt):
        xs = int(round(k2(y) - 3))
        out[y] = np.concatenate([a[y][:xs], a[y][xs + adim:], np.full((adim, 3), 255, dtype=a.dtype)])
    s = adim // 2
    serit = out[ust:alt].copy()
    out[ust:alt] = np.concatenate([np.full((serit.shape[0], s, 3), 255, dtype=a.dtype), serit[:, :w - s]], axis=1)
    return Image.fromarray(out)


def beyaz_kirp(im, pay=24, esik=235):
    """Beyaz kenar boşluğunu kırpar (pay px bırakır)."""
    a = np.asarray(im.convert('L'))
    ys, xs = np.where(a < esik)
    x0, y0, x1, y1 = max(0, xs.min() - pay), max(0, ys.min() - pay), min(a.shape[1], xs.max() + pay + 1), min(a.shape[0], ys.max() + pay + 1)
    return im.crop((x0, y0, x1, y1))


def saydam(im, esik=232):
    """Dıştaki beyazı saydam yapar; kenar piksellerini beyazdan ayrıştırır (color-to-alpha)."""
    a = np.asarray(im.convert('RGB')).astype(np.float64)
    acik = a.min(axis=2) >= esik
    etiket, _ = ndimage.label(acik)
    kenar = set(np.unique(np.concatenate([etiket[0, :], etiket[-1, :], etiket[:, 0], etiket[:, -1]])))
    kenar.discard(0)
    dis = np.isin(etiket, list(kenar))
    # Dış bölge + 2 piksellik kuşak: beyazdan ayrıştır
    kusak = ndimage.binary_dilation(dis, iterations=2)
    alfa = np.ones(a.shape[:2])
    fark = (255.0 - a).max(axis=2) / 255.0  # beyazdan uzaklık
    alfa[kusak] = np.clip(fark[kusak] * 1.15, 0, 1)
    alfa[dis] = np.where(fark[dis] > 0.12, alfa[dis], 0)
    renk = a.copy()
    m = kusak & (alfa > 0.01)
    for k in range(3):
        renk[..., k][m] = np.clip(255.0 - (255.0 - a[..., k][m]) / alfa[m], 0, 255)
    out = np.dstack([renk, alfa * 255.0]).round().astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def kareye(im, kenar_payi=0.0, zemin=(0, 0, 0, 0)):
    w, h = im.size
    s = int(max(w, h) * (1 + kenar_payi))
    out = Image.new('RGBA', (s, s), zemin)
    out.paste(im, ((s - w) // 2, (s - h) // 2), im if im.mode == 'RGBA' else None)
    return out


def yuvarlak_kare(boyut, yaricap, renk=(255, 255, 255, 255)):
    im = Image.new('RGBA', (boyut, boyut), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, boyut - 1, boyut - 1), radius=yaricap, fill=renk)
    return im


def kaydet(im, yol, palet=False):
    """palet: 256 renge indirerek küçült (logo düz renkli; gözle fark edilmez)."""
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    if palet:
        im = im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.Dither.NONE) if im.mode == 'RGBA' \
            else im.convert('RGB').quantize(colors=256, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    im.save(yol, optimize=True)
    print(os.path.relpath(yol, KOK), im.size, os.path.getsize(yol) // 1024, 'KB')


def main():
    kaynak = Image.open(KAYNAK).convert('RGB')
    if DUZELT:
        kaynak = hakedis_duzelt(kaynak)

    # Tam logo: beyaz zeminde (koyu ekranlarda beyaz kart üstünde gösterilir)
    tam = beyaz_kirp(kaynak)
    g = 720
    tam = tam.resize((g, round(tam.height * g / tam.width)), Image.LANCZOS)
    kaydet(tam, os.path.join(MARKA, 'sebeke-m-logo.png'), True)

    # Amblem: saydam zemin, kare
    amb = saydam(kaynak.crop(AMBLEM))
    bbox = amb.getbbox()
    amb = kareye(amb.crop(bbox), 0.04)
    amb512 = amb.resize((512, 512), Image.LANCZOS)
    kaydet(amb512, os.path.join(MARKA, 'sebeke-m-amblem.png'), True)

    # Uygulama simgesi: beyaz yuvarlak köşeli kare + amblem (%80)
    simge = yuvarlak_kare(512, 104)
    a = amb.resize((410, 410), Image.LANCZOS)
    simge.alpha_composite(a, ((512 - 410) // 2, (512 - 410) // 2))
    kaydet(simge, os.path.join(MARKA, 'sebeke-m-simge.png'), True)

    # Küçük rozetler (şerit düğmesi, pencere başlığı): 8 kat büyük çizilip küçültülür, amblem rozetin %86'sı
    for px in (16, 24, 32, 64):
        b = yuvarlak_kare(px * 8, round(px * 8 * 0.2))
        t = round(px * 8 * 0.86)
        b.alpha_composite(amb.resize((t, t), Image.LANCZOS), ((px * 8 - t) // 2, (px * 8 - t) // 2))
        kaydet(b.resize((px, px), Image.LANCZOS), os.path.join(MARKA, 'sebeke-m-simge-%d.png' % px))

    # Android simgeleri
    res = os.path.join(KOK, 'telefon/android/res')
    for ad, olcek in (('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)):
        eski = simge.resize((round(48 * olcek), round(48 * olcek)), Image.LANCZOS)
        kaydet(eski, os.path.join(res, 'mipmap-' + ad, 'ic_launcher.png'))
        # Uyarlanabilir simge: 108 dp tuval, amblem 66 dp güvenli dairenin içinde (~62 dp)
        tuval = round(108 * olcek)
        on = Image.new('RGBA', (tuval, tuval), (0, 0, 0, 0))
        b = round(62 * olcek)
        on.alpha_composite(amb.resize((b, b), Image.LANCZOS), ((tuval - b) // 2, (tuval - b) // 2))
        kaydet(on, os.path.join(res, 'mipmap-' + ad, 'ic_launcher_fg.png'))

    # Telefonun web paketi
    web = os.path.join(KOK, 'telefon/web/assets')
    kaydet(tam, os.path.join(web, 'sebeke-m-logo.png'), True)
    kaydet(amb.resize((192, 192), Image.LANCZOS), os.path.join(web, 'sebeke-m-amblem.png'), True)
    kaydet(simge.resize((192, 192), Image.LANCZOS), os.path.join(web, 'sebeke-m-simge.png'), True)


if __name__ == '__main__':
    main()
