// App Android do Launcher. O núcleo (launcher/core) é um build Kotlin puro incluído aqui.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "tv-smart-adaptative-launcher"
include(":app")
includeBuild("core")
