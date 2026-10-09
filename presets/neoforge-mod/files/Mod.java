package {{input.package}};

import com.mojang.logging.LogUtils;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.event.lifecycle.FMLCommonSetupEvent;
import org.slf4j.Logger;

// The value here must match the modId in META-INF/neoforge.mods.toml
@Mod({{input.name}}.MODID)
public class {{input.name}} {

    public static final String MODID = "{{input.modId}}";
    public static final Logger LOGGER = LogUtils.getLogger();

    // The constructor is the first code that runs when the mod is loaded. FML passes in the
    // parameter types it recognizes, such as IEventBus and ModContainer.
    public {{input.name}}(IEventBus modEventBus) {
        modEventBus.addListener(this::commonSetup);
    }

    private void commonSetup(FMLCommonSetupEvent event) {
        LOGGER.info("{} common setup", MODID);
    }
}
