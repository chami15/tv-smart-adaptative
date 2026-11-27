package com.tvsmartadaptative.launcher.core

/** Perfil v1 — espelho de shared/profile/profile.schema.json. */
data class Profile(
    val name: String,
    val theme: Theme = Theme(),
    val clock: Clock = Clock(),
    val iconSize: IconSize = IconSize.AUTO,
    val lightMode: LightMode = LightMode.AUTO,
    val rows: List<Row>,
) {
    companion object {
        const val SCHEMA_VERSION = 1
    }
}

data class Theme(
    val background: String = "#0F1218",
    val accent: String = "#5B8CFF",
    val text: String = "#E8EBF2",
)

data class Clock(val show: Boolean = true, val format24h: Boolean = true)

enum class IconSize(val json: String) { AUTO("auto"), SMALL("small"), MEDIUM("medium"), LARGE("large") }

enum class LightMode(val json: String) { AUTO("auto"), ON("on"), OFF("off") }

enum class RowType(val json: String) { APPS("apps"), INPUTS("inputs"), ALL_APPS("all-apps") }

data class Row(val id: String, val title: String, val type: RowType, val apps: List<String> = emptyList())

/** Perfil embutido: usado quando nunca houve perfil válido. Simples e sempre funcional. */
val BUILTIN_PROFILE = Profile(
    name = "Padrão",
    rows = listOf(
        Row(id = "entradas", title = "Entradas", type = RowType.INPUTS),
        Row(id = "todos", title = "Todos os apps", type = RowType.ALL_APPS),
    ),
)
