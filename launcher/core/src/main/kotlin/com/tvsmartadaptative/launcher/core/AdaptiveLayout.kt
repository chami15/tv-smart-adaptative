package com.tvsmartadaptative.launcher.core

import kotlin.math.max
import kotlin.math.roundToInt

/** O que o Launcher sabe da TV em que está rodando. */
data class DeviceTraits(
    val widthPx: Int,
    val heightPx: Int,
    val densityDpi: Int,
    val totalRamMb: Int,
    val apiLevel: Int,
    val isLowRamDevice: Boolean = false,
)

enum class ScreenClass { HD, FULL_HD, UHD }

data class LayoutSpec(
    val screenClass: ScreenClass,
    val widthDp: Int,
    val cardWidthDp: Int,
    val cardHeightDp: Int,
    val columnsVisible: Int,
    val lightMode: Boolean,
    val animations: Boolean,
    val maxItemsPerRow: Int,
)

/** Abaixo disso a TV é tratada como "pouca memória" e o modo leve liga sozinho (em 'auto'). */
const val LOW_RAM_THRESHOLD_MB = 2500

object AdaptiveLayout {
    private const val SIDE_PADDING_DP = 48
    private const val GAP_DP = 16

    fun compute(traits: DeviceTraits, profile: Profile): LayoutSpec {
        val density = if (traits.densityDpi > 0) traits.densityDpi else 160
        val shortSide = minOf(traits.widthPx, traits.heightPx)
        val screenClass = when {
            shortSide >= 2160 -> ScreenClass.UHD
            shortSide >= 1080 -> ScreenClass.FULL_HD
            else -> ScreenClass.HD
        }
        val widthDp = (maxOf(traits.widthPx, traits.heightPx) * 160.0 / density).roundToInt()

        val lowMemory = traits.isLowRamDevice || traits.totalRamMb in 1 until LOW_RAM_THRESHOLD_MB
        val light = when (profile.lightMode) {
            LightMode.ON -> true
            LightMode.OFF -> false
            LightMode.AUTO -> lowMemory
        }

        val size = when (profile.iconSize) {
            IconSize.AUTO -> if (screenClass == ScreenClass.HD) IconSize.SMALL else IconSize.MEDIUM
            else -> profile.iconSize
        }
        val cardWidth = when (size) {
            IconSize.SMALL -> 160
            IconSize.LARGE -> 240
            else -> 200
        }
        val cardHeight = (cardWidth * 9.0 / 16.0).roundToInt() // banners de TV são 16:9
        val usable = max(widthDp - 2 * SIDE_PADDING_DP, cardWidth)
        val columns = max(1, (usable + GAP_DP) / (cardWidth + GAP_DP))

        return LayoutSpec(
            screenClass = screenClass,
            widthDp = widthDp,
            cardWidthDp = cardWidth,
            cardHeightDp = cardHeight,
            columnsVisible = columns,
            lightMode = light,
            animations = !light && traits.apiLevel >= 26,
            maxItemsPerRow = if (light) 24 else 60,
        )
    }
}
