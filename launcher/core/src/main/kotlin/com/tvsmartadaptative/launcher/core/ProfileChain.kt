package com.tvsmartadaptative.launcher.core

enum class ProfileOrigin { NEW, LAST_VALID, BUILTIN }

data class SelectedProfile(val profile: Profile, val origin: ProfileOrigin, val rejectedErrors: List<String> = emptyList())

/**
 * Cadeia de segurança: a tela inicial NUNCA fica sem perfil.
 * perfil atual válido → último perfil válido → perfil embutido.
 */
fun selectProfile(currentText: String?, lastValidText: String?): SelectedProfile {
    var rejected = emptyList<String>()
    if (currentText != null) {
        when (val r = ProfileParser.parse(currentText)) {
            is ProfileResult.Ok -> return SelectedProfile(r.profile, ProfileOrigin.NEW)
            is ProfileResult.Invalid -> rejected = r.errors
        }
    }
    if (lastValidText != null) {
        val r = ProfileParser.parse(lastValidText)
        if (r is ProfileResult.Ok) return SelectedProfile(r.profile, ProfileOrigin.LAST_VALID, rejected)
    }
    return SelectedProfile(BUILTIN_PROFILE, ProfileOrigin.BUILTIN, rejected)
}
