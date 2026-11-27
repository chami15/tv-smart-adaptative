package com.tvsmartadaptative.launcher.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProfileChainTest {
    private val valid = """{"schemaVersion":1,"name":"Novo","rows":[{"id":"a","title":"A","type":"all-apps"}]}"""
    private val older = """{"schemaVersion":1,"name":"Antigo","rows":[{"id":"a","title":"A","type":"all-apps"}]}"""

    @Test fun `perfil novo valido e usado`() {
        assertEquals(ProfileOrigin.NEW, selectProfile(valid, older).origin)
    }

    @Test fun `perfil novo quebrado cai no ultimo valido e guarda o motivo`() {
        val s = selectProfile("{quebrado", older)
        assertEquals(ProfileOrigin.LAST_VALID, s.origin)
        assertEquals("Antigo", s.profile.name)
        assertTrue(s.rejectedErrors.isNotEmpty())
    }

    @Test fun `sem nada valido usa o embutido - a tela nunca fica vazia`() {
        val s = selectProfile("{quebrado", "tambem quebrado")
        assertEquals(ProfileOrigin.BUILTIN, s.origin)
        assertEquals(BUILTIN_PROFILE, s.profile)
        assertEquals(ProfileOrigin.BUILTIN, selectProfile(null, null).origin)
    }
}
