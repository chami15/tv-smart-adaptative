package com.tvsmartadaptative.launcher.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RowResolverTest {
    private val own = "com.tvsmartadaptative.launcher"
    private val apps = listOf(
        InstalledApp("com.netflix.ninja", "Netflix"),
        InstalledApp("com.google.android.youtube.tv", "YouTube"),
        InstalledApp("com.globo.globotv", "Globoplay"),
        InstalledApp("org.videolan.vlc", "VLC"),
        InstalledApp("com.app.acento", "Ábaco"),
        InstalledApp(own, "TV Smart Adaptative"),
    )
    private val inputs = listOf(TvInputInfo("hdmi1", "HDMI 1"), TvInputInfo("hdmi2", "HDMI 2"))

    private fun profile(vararg rows: Row) = Profile(name = "x", rows = rows.toList())

    @Test fun `favoritos na ordem do perfil, apps ausentes somem`() {
        val rows = RowResolver.resolve(profile(Row("fav", "Favoritos", RowType.APPS, listOf("com.globo.globotv", "com.nao.instalado", "com.netflix.ninja"))), apps, inputs, own, 60)
        assertEquals(listOf("com.globo.globotv", "com.netflix.ninja"), rows[0].items.map { (it as Item.App).pkg })
    }

    @Test fun `sempre existe Todos os apps e Ajustes, mesmo se o perfil esquecer`() {
        val rows = RowResolver.resolve(profile(Row("fav", "Favoritos", RowType.APPS, listOf("com.netflix.ninja"))), apps, inputs, own, 60)
        assertEquals(listOf("fav", "_todos", RowResolver.SYSTEM_ROW_ID), rows.map { it.id })
        assertEquals(listOf<Item>(Item.Settings), rows.last().items)
    }

    @Test fun `todos os apps em ordem alfabetica em portugues, sem o proprio launcher`() {
        val rows = RowResolver.resolve(profile(Row("t", "Todos", RowType.ALL_APPS)), apps, emptyList(), own, 60)
        assertEquals(listOf("Ábaco", "Globoplay", "Netflix", "VLC", "YouTube"), rows[0].items.map { (it as Item.App).label })
        assertEquals(2, rows.size) // não duplica "Todos os apps"
    }

    @Test fun `fileira de entradas some em TV sem entradas (ex - TV box)`() {
        val p = profile(Row("e", "Entradas", RowType.INPUTS), Row("t", "Todos", RowType.ALL_APPS))
        assertEquals(listOf("t", RowResolver.SYSTEM_ROW_ID), RowResolver.resolve(p, apps, emptyList(), own, 60).map { it.id })
        assertEquals(2, RowResolver.resolve(p, apps, inputs, own, 60)[0].items.size)
    }

    @Test fun `limite de itens por fileira no modo leve`() {
        val many = (1..50).map { InstalledApp("com.app.n$it", "App $it") }
        val rows = RowResolver.resolve(profile(Row("t", "Todos", RowType.ALL_APPS)), many, emptyList(), own, 24)
        assertEquals(24, rows[0].items.size)
        assertTrue(rows.last().items.contains(Item.Settings))
    }
}
