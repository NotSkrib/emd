# {{input.name}}

{{input.description|xml}}

Built for Paper {{resolved.minecraft}} on Java {{resolved.java}}. Author: {{input.author|xml}}.

## Build

```bash
gradle build
```

The jar is written to `build/libs/`. Copy it into a server's `plugins/` folder.

## Try it locally

```bash
gradle runServer
```
