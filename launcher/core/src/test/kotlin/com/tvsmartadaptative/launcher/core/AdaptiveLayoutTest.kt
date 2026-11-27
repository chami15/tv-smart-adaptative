package com.tvsmartadaptative.launcher.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AdaptiveLayoutTest {
    private val profile = BUILTIN_PROFILE

    private fun tv(w: Int, h: Int, dpi: Int, ram: Int, api: Int = 31) = DeviceTraits(w, h, dpi, ram, api)

    @Test fun `TV 4K com 2 GB - modo leve automatico, sem animacoes`() {
        val l = AdaptiveLayout.compute(tv(3840, 2160, 640, 1900), profile)
        assertEquals(ScreenClass.UHD, l.screenClass)
        assertEquals(960, l.widthDp)
        assertTrue(l.lightMode)
        assertFalse(l.animations)
        assertEquals(24, l.maxItemsPerRow)
    }

    @Test fun `TV Full HD com 3 GB - animacoes ligadas`() {
        val l = AdaptiveLayout.compute(tv(1920, 1080, 320, 2900), profile)
        assertEquals(ScreenClass.FULL_HD, l.screenClass)
        assertFalse(l.lightMode)
        assertTrue(l.animations)
        assertEquals(4, l.columnsVisible) // (960-96+16)/(200+16)
    }

    @Test fun `box HD com 1 GB - cartoes pequenos e modo leve`() {
        val l = AdaptiveLayout.compute(tv(1280, 720, 213, 900, api = 29), profile)
        assertEquals(ScreenClass.HD, l.screenClass)
        assertEquals(160, l.cardWidthDp)
        assertTrue(l.lightMode)
    }

    @Test fun `escolhas do perfil vencem o automatico`() {
        val p = profile.copy(lightMode = LightMode.OFF, iconSize = IconSize.LARGE)
        val l = AdaptiveLayout.compute(tv(3840, 2160, 640, 1900), p)
        assertFalse(l.lightMode)
        assertEquals(240, l.cardWidthDp)
        assertEquals(135, l.cardHeightDp)
    }

    @Test fun `dados estranhos do aparelho nao quebram`() {
        val l = AdaptiveLayout.compute(DeviceTraits(0, 0, 0, 0, 0), profile)
        assertTrue(l.columnsVisible >= 1)
    }

    @Test fun `aparelho marcado como low ram pelo sistema liga modo leve`() {
        assertTrue(AdaptiveLayout.compute(DeviceTraits(1920, 1080, 320, 4000, 30, isLowRamDevice = true), profile).lightMode)
    }
}
