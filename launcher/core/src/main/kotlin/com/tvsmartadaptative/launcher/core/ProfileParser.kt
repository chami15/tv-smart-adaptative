package com.tvsmartadaptative.launcher.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

sealed interface ProfileResult {
    data class Ok(val profile: Profile) : ProfileResult
    data class Invalid(val errors: List<String>) : ProfileResult
}

/**
 * Mesmas regras de studio/core/src/profile/index.ts. Os exemplos em shared/profile/examples
 * são testados pelos dois lados para garantir que não divergem.
 */
object ProfileParser {
    private val COLOR = Regex("^#[0-9A-Fa-f]{6}$")
    private val ROW_ID = Regex("^[a-z0-9-]{1,32}$")
    private val PACKAGE = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")

    fun parse(text: String): ProfileResult {
        val root = try {
            Json.parseToJsonElement(text)
        } catch (e: Exception) {
            return ProfileResult.Invalid(listOf("O arquivo do perfil não é um JSON válido."))
        }
        return validate(root)
    }

    fun validate(root: JsonElement): ProfileResult {
        val errors = mutableListOf<String>()
        if (root !is JsonObject) return ProfileResult.Invalid(listOf("O perfil precisa ser um objeto JSON."))

        val version = (root["schemaVersion"] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
        if (version != Profile.SCHEMA_VERSION.toDouble()) errors += "Versão de perfil não suportada: ${root["schemaVersion"] ?: "ausente"} (esperado 1)."
        val name = root.str("name")
        if (name == null || name.length !in 1..60) errors += "O nome do perfil deve ter de 1 a 60 caracteres."

        var theme = Theme()
        root["theme"]?.let { t ->
            if (t !is JsonObject) errors += "\"theme\" deve ser um objeto."
            else {
                fun color(key: String, default: String): String {
                    val v = t[key] ?: return default
                    val s = (v as? JsonPrimitive)?.takeIf { it.isString }?.content
                    if (s == null || !COLOR.matches(s)) { errors += "Cor inválida em theme.$key (use o formato #RRGGBB)."; return default }
                    return s
                }
                theme = Theme(color("background", theme.background), color("accent", theme.accent), color("text", theme.text))
            }
        }

        var clock = Clock()
        root["clock"]?.let { c ->
            if (c !is JsonObject) errors += "\"clock\" deve ser um objeto."
            else {
                fun bool(key: String, default: Boolean): Boolean {
                    val v = c[key] ?: return default
                    val b = (v as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
                    if (b == null) { errors += "clock.$key deve ser verdadeiro ou falso."; return default }
                    return b
                }
                clock = Clock(bool("show", clock.show), bool("format24h", clock.format24h))
            }
        }

        var iconSize = IconSize.AUTO
        root["iconSize"]?.let { v ->
            val found = IconSize.entries.firstOrNull { it.json == (v as? JsonPrimitive)?.contentOrNullIfString() }
            if (found == null) errors += "iconSize inválido (auto, small, medium ou large)." else iconSize = found
        }
        var lightMode = LightMode.AUTO
        root["lightMode"]?.let { v ->
            val found = LightMode.entries.firstOrNull { it.json == (v as? JsonPrimitive)?.contentOrNullIfString() }
            if (found == null) errors += "lightMode inválido (auto, on ou off)." else lightMode = found
        }

        val rows = mutableListOf<Row>()
        val rowsEl = root["rows"]
        if (rowsEl !is JsonArray || rowsEl.size !in 1..12) {
            errors += "O perfil precisa de 1 a 12 fileiras."
        } else {
            val ids = mutableSetOf<String>()
            rowsEl.forEachIndexed { i, el ->
                val where = "Fileira ${i + 1}"
                if (el !is JsonObject) { errors += "$where: precisa ser um objeto."; return@forEachIndexed }
                val id = el.str("id")
                when {
                    id == null || !ROW_ID.matches(id) -> errors += "$where: id inválido (letras minúsculas, números e hífen)."
                    !ids.add(id) -> errors += "$where: id \"$id\" repetido."
                }
                val title = el.str("title")
                if (title == null || title.length !in 1..40) errors += "$where: título deve ter de 1 a 40 caracteres."
                val typeRaw = (el["type"] as? JsonPrimitive)?.contentOrNullIfString()
                val type = RowType.entries.firstOrNull { it.json == typeRaw }
                if (type == null) { errors += "$where: tipo desconhecido \"${typeRaw ?: el["type"]}\"."; return@forEachIndexed }
                var apps = emptyList<String>()
                if (type == RowType.APPS) {
                    val list = el["apps"]
                    when {
                        list !is JsonArray -> errors += "$where: fileira de apps precisa da lista \"apps\"."
                        list.size > 40 -> errors += "$where: no máximo 40 apps."
                        else -> {
                            val seen = LinkedHashSet<String>()
                            for (a in list) {
                                val s = (a as? JsonPrimitive)?.contentOrNullIfString()
                                when {
                                    s == null || s.length > 255 || !PACKAGE.matches(s) -> errors += "$where: app inválido $a."
                                    !seen.add(s) -> errors += "$where: app $s repetido."
                                }
                            }
                            apps = seen.toList()
                        }
                    }
                }
                rows += Row(id = id ?: "", title = title ?: "", type = type, apps = apps)
            }
        }

        return if (errors.isEmpty()) ProfileResult.Ok(Profile(name!!, theme, clock, iconSize, lightMode, rows))
        else ProfileResult.Invalid(errors)
    }

    private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNullIfString()
    private fun JsonPrimitive.contentOrNullIfString(): String? = if (this is JsonNull || !isString) null else content
}
