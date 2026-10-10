---
name: emd-forge-basics
description: "Use when the user wants a Minecraft Forge mod, or a build file for Forge 26.x. EMD has no Forge preset, so this gives the facts from a real build: ForgeGradle 7, the dependency form, the mod class and the descriptor. Triggers on: Forge mod, ForgeGradle, mods.toml, net.minecraftforge, Forge MDK, javafml."
license: MIT
---
# Forge mods, without a preset

`emd` has no Forge preset. Forge's MDK is licensed under the LGPL 2.1 and its examples repository has no license at all, and EMD's presets may copy only from MIT, Apache-2.0, CC0, BSD, ISC, 0BSD and Unlicense projects. So `emd new` cannot generate a Forge project, and you must not copy Forge's MDK files into one.

What follows was checked on 2026-10-10 by building a mod written from scratch with real Gradle. It compiled and produced a jar with the mod class and `META-INF/mods.toml`. Nothing was started in the game, so the mod loading is **not proven**.

## Get the versions from emd

Run `emd versions --mc <version>` (as `npx emd-minecraft` if `emd` is not on the PATH). Use its Java version, its Gradle version and the number on its `Forge` line. Do not write a Minecraft, Forge or Java version from memory. If the `Forge` line says there is no build, tell the user.

## The build

- **Plugin:** ForgeGradle 7, plugin id `net.minecraftforge.gradle`, with a version range inside the 7.x line. ForgeGradle itself says it needs Gradle 9.3.0 or newer, so use the Gradle that `emd versions` prints.
- **Dependency:** `implementation minecraft.dependency('net.minecraftforge:forge:<minecraft>-<forge>')`, where `<minecraft>` is the Minecraft version and `<forge>` is the number from the `Forge` line, joined by a hyphen.
- **Repositories:** inside `repositories { }`, `minecraft.mavenizer(it)`, `maven fg.forgeMaven`, `maven fg.minecraftLibsMaven` and `mavenCentral()`.
- **Java:** a toolchain with the Java version `emd versions` prints.
- **Mappings** are chosen automatically (the build log said `official-<minecraft>`). The build needed no `mappings` line and no `fg.deobf(...)`. Do not add them from older Forge guides.
- **Runs:** `minecraft { runs { register('client'); register('server') { args '--nogui' } } }` creates the tasks `runClient` and `runServer`, and also `runTestClient` and `runTestServer`.
- **Jar-in-Jar** needs its own plugin, `net.minecraftforge.jarjar`. For Minecraft 1.20.6 and newer ForgeGradle needs no extra setup. Older versions need the Renamer plugin, which ForgeGradle calls experimental.
- ForgeGradle 6 add-ons such as Parchment's Librarian do not work with ForgeGradle 7.
- The first build is slow. It took about 15 minutes on a desktop, because it downloads, decompiles and patches Minecraft. Give it a long timeout.

## The mod

```java
@Mod(MyMod.MODID)
public final class MyMod {
    public static final String MODID = "mymod";

    public MyMod(FMLJavaModLoadingContext context) {
        FMLCommonSetupEvent.getBus(context.getModBusGroup()).addListener(this::commonSetup);
    }

    private void commonSetup(FMLCommonSetupEvent event) { }
}
```

- The class takes an `FMLJavaModLoadingContext`. The mod event bus group is `context.getModBusGroup()`, and a lifecycle event is listened to with `FMLCommonSetupEvent.getBus(modBusGroup).addListener(...)`. Imports are `net.minecraftforge.fml.common.Mod`, `net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext` and `net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent`.
- The id in `@Mod(...)` must match `modId` in the descriptor.

## The descriptor

`src/main/resources/META-INF/mods.toml` has `modLoader = "javafml"`, a `loaderVersion` range, a `license`, and a `[[mods]]` table with `modId`, `version`, `displayName` and `description`. The `license` is the mod's own license, which is the author's choice. Forge's own license text says mods that use Forge as a library through ordinary Java mechanisms are not bound by Forge's license.

Forge's MDK also adds `[[dependencies.<modid>]]` tables for `forge` and `minecraft` with version ranges. The probe built without them, and whether the game accepts a descriptor without them was not tested.

## Do not mix up Forge and NeoForge

They are separate loaders. Forge uses `net.minecraftforge` packages, `mods.toml` and ForgeGradle. NeoForge uses `net.neoforged` packages, `neoforge.mods.toml` and ModDevGradle, and `emd` has a `neoforge-mod` preset for it (see the `emd-preset-guide` skill). If the user does not need Forge in particular, say so once and let them choose.

## Report

State that the mod was built and not run. For build errors, use the `emd-build-troubleshooting` skill. To try it in the game, follow the `emd-local-testing` skill and never accept the EULA for the user.
