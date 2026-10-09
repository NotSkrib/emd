package {{input.package}};

import org.bukkit.plugin.java.JavaPlugin;

public final class {{input.name}} extends JavaPlugin {

    @Override
    public void onEnable() {
        getSLF4JLogger().info("{{input.name}} enabled");
    }

    @Override
    public void onDisable() {
        getSLF4JLogger().info("{{input.name}} disabled");
    }
}
