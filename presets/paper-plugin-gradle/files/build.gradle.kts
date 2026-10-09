plugins {
    java
    id("xyz.jpenilla.run-paper") version "3.0.2"
}

group = "{{input.package}}"
version = "{{input.version}}"
description = "{{input.description|kotlin}}"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:{{resolved.paperApi}}")
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of({{resolved.java}}))
}

tasks {
    compileJava {
        options.encoding = "UTF-8"
        options.release.set({{resolved.java}})
    }
    processResources {
        val pluginVersion = project.version.toString()
        inputs.property("pluginVersion", pluginVersion)
        filesMatching("plugin.yml") {
            filter { line -> line.replace("@version@", pluginVersion) }
        }
    }
    runServer {
        minecraftVersion("{{resolved.minecraft}}")
    }
}
