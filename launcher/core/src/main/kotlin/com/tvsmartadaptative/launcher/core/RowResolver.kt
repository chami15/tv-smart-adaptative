package com.tvsmartadaptative.launcher.core

import java.text.Collator
import java.util.Locale

data class InstalledApp(val pkg: String, val label: String)

data class TvInputInfo(val id: String, val label: String)

sealed interface Item {
    data class App(val pkg: String, val label: String) : Item
    data class Input(val id: String, val label: String) : Item
    data object Settings : Item
}

data class ResolvedRow(val id: String, val title: String, val items: List<Item>)

/**
 * Transforma o perfil em fileiras concretas para ESTA TV:
 * apps ausentes somem, entradas vêm do sistema, e há sempre um caminho para
 * "Todos os apps" e "Configurações" (ninguém fica preso na tela inicial).
 */
object RowResolver {
    const val SYSTEM_ROW_ID = "_sistema"

    fun resolve(
        profile: Profile,
        apps: List<InstalledApp>,
        inputs: List<TvInputInfo>,
        ownPackage: String,
        maxItemsPerRow: Int,
    ): List<ResolvedRow> {
        val byPkg = apps.filter { it.pkg != ownPackage }.associateBy { it.pkg }
        val collator = Collator.getInstance(Locale.forLanguageTag("pt-BR")).apply { strength = Collator.PRIMARY }
        val allSorted = byPkg.values.sortedWith(compareBy(collator) { it.label })

        val rows = mutableListOf<ResolvedRow>()
        var hasAllApps = false
        for (row in profile.rows) {
            val items: List<Item> = when (row.type) {
                RowType.APPS -> row.apps.mapNotNull { byPkg[it] }.map { Item.App(it.pkg, it.label) }
                RowType.INPUTS -> inputs.map { Item.Input(it.id, it.label) }
                RowType.ALL_APPS -> {
                    hasAllApps = true
                    allSorted.map { Item.App(it.pkg, it.label) }
                }
            }
            if (items.isNotEmpty()) rows += ResolvedRow(row.id, row.title, items.take(maxItemsPerRow))
        }
        if (!hasAllApps) rows += ResolvedRow("_todos", "Todos os apps", allSorted.take(maxItemsPerRow).map { Item.App(it.pkg, it.label) })
        rows += ResolvedRow(SYSTEM_ROW_ID, "Ajustes", listOf(Item.Settings))
        return rows
    }
}
