# {{input.title|xml}}

{{input.description|xml}}

A Fabric mod for Minecraft {{resolved.minecraft}} on Java {{resolved.java}}. Author: {{input.author|xml}}.

## Requirements

Gradle {{resolved.gradle}} or newer (the current release when this project was generated). Fabric Loom needs a recent Gradle: an older one stops with a "No matching variant" error.

To pin it, run `gradle wrapper --gradle-version {{resolved.gradle}}` once. If your installed Gradle is older and that command fails, run it in an empty folder and copy `gradlew`, `gradlew.bat` and `gradle/` into this project.

## Build

```bash
gradle build
```

The jar is written to `build/libs/`. Copy it into a Fabric instance's `mods/` folder together with Fabric API.

## Try it locally

```bash
gradle runClient
```
