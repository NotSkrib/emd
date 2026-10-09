plugins {
    java
    id("xyz.jpenilla.run-velocity") version "3.0.2"
}

group = "{{input.package}}"
version = "{{input.version}}"
description = "{{input.description|kotlin}}"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("com.velocitypowered:velocity-api:{{resolved.velocityApi}}")
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of({{resolved.velocityJava}}))
}

tasks {
    compileJava {
        options.encoding = "UTF-8"
        options.release.set({{resolved.velocityJava}})
    }
    processResources {
        val pluginVersion = project.version.toString()
        inputs.property("pluginVersion", pluginVersion)
        filesMatching("velocity-plugin.json") {
            filter { line -> line.replace("@version@", pluginVersion) }
        }
    }
    runVelocity {
        velocityVersion("{{resolved.velocityApi}}")
    }
}
