# {{input.name}}

{{input.description|xml}}

A Velocity proxy plugin for Velocity {{resolved.velocityApi}} on Java {{resolved.velocityJava}}. Author: {{input.author|xml}}.

## Requirements

Gradle {{resolved.gradle}} or newer (the current release when this project was generated), and a JDK {{resolved.velocityJava}} (Gradle can download one). The plugins in `build.gradle.kts` need a recent Gradle: an older one stops with a "No matching variant" error.

To pin it, run `gradle wrapper --gradle-version {{resolved.gradle}}` once. If your installed Gradle is older and that command fails, run it in an empty folder and copy `gradlew`, `gradlew.bat` and `gradle/` into this project.

## Build

```bash
gradle build
```

The jar is written to `build/libs/`. Copy it into the proxy's `plugins/` folder.

## Try it locally

```bash
gradle runVelocity
```
