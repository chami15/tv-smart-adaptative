package com.tvsmartadaptative.launcher

import android.content.Context
import com.tvsmartadaptative.launcher.core.ProfileParser
import com.tvsmartadaptative.launcher.core.ProfileResult
import com.tvsmartadaptative.launcher.core.SelectedProfile
import com.tvsmartadaptative.launcher.core.selectProfile
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Guarda o perfil no armazenamento privado do app.
 * Um perfil novo só substitui o atual se for válido; o último válido é sempre preservado.
 */
class ProfileStore(context: Context) {
    private val dir = context.filesDir
    private val current = File(dir, "profile.json")
    private val lastValid = File(dir, "profile-last-valid.json")

    fun load(): SelectedProfile = selectProfile(current.readTextOrNull(), lastValid.readTextOrNull())

    /** Valida e grava. Nunca sobrescreve nada se o perfil for inválido. */
    fun save(text: String): ProfileResult {
        val result = ProfileParser.parse(text)
        if (result is ProfileResult.Ok) {
            writeAtomically(current, text)
            writeAtomically(lastValid, text)
            ProfileEvents.bump()
        }
        return result
    }

    private fun File.readTextOrNull(): String? = try {
        if (exists()) readText() else null
    } catch (e: Exception) {
        null
    }

    private fun writeAtomically(target: File, text: String) {
        val tmp = File(target.parentFile, target.name + ".tmp")
        tmp.writeText(text)
        if (!tmp.renameTo(target)) {
            target.writeText(text)
            tmp.delete()
        }
    }
}

/** Avisa a tela inicial que chegou perfil novo (mesmo processo). */
object ProfileEvents {
    private val _version = MutableStateFlow(0)
    val version: StateFlow<Int> = _version
    fun bump() {
        _version.value = _version.value + 1
    }
}
