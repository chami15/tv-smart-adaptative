package com.tvsmartadaptative.launcher.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/** Os MESMOS exemplos que o Studio (TypeScript) testa — garante que os dois lados concordam. */
class ProfileParserTest {
    private val examples = File(System.getProperty("tvsa.examples"))

    @TestFactory
    fun `exemplos validos compartilhados`() = examples.resolve("valid").listFiles()!!.sorted().map { f ->
        DynamicTest.dynamicTest("válido: ${f.name}") {
            val r = ProfileParser.parse(f.readText())
            assertIs<ProfileResult.Ok>(r, "esperava válido: $r")
        }
    }

    @TestFactory
    fun `exemplos invalidos compartilhados`() = examples.resolve("invalid").listFiles()!!.sorted().map { f ->
        DynamicTest.dynamicTest("inválido: ${f.name}") {
            val r = ProfileParser.parse(f.readText())
            assertIs<ProfileResult.Invalid>(r, "esperava inválido: ${f.name}")
            assertTrue(r.errors.isNotEmpty())
        }
    }

    @Test
    fun `perfil completo e lido com todos os campos`() {
        val r = ProfileParser.parse(examples.resolve("valid/completo.json").readText()) as ProfileResult.Ok
        assertEquals("TV da Sala", r.profile.name)
        assertEquals(listOf(RowType.APPS, RowType.INPUTS, RowType.ALL_APPS), r.profile.rows.map { it.type })
        assertEquals(listOf("com.netflix.ninja", "com.google.android.youtube.tv"), r.profile.rows[0].apps)
        assertEquals("#5B8CFF", r.profile.theme.accent)
    }

    @Test
    fun `perfil minimo usa padroes`() {
        val r = ProfileParser.parse(examples.resolve("valid/minimo.json").readText()) as ProfileResult.Ok
        assertEquals(LightMode.AUTO, r.profile.lightMode)
        assertEquals(true, r.profile.clock.show)
    }

    @Test
    fun `mensagens de erro em portugues`() {
        val r = ProfileParser.parse(examples.resolve("invalid/id-repetido.json").readText()) as ProfileResult.Invalid
        assertTrue(r.errors.any { "repetido" in it }, r.errors.toString())
    }
}
