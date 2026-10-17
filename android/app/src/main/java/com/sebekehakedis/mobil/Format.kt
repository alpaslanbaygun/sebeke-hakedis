package com.sebekehakedis.mobil

import java.util.Locale

internal const val DASH = "—"

/** Ondalık virgülü de kabul eder; sayı değilse NaN. */
internal fun parseNumber(text: String): Double = text.replace(',', '.').trim().toDoubleOrNull() ?: Double.NaN

internal fun fmt(v: Double, decimals: Int): String =
    if (v.isNaN()) DASH else String.format(Locale.US, "%.${decimals}f", v)
