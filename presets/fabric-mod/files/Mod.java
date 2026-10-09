package {{input.package}};

import net.fabricmc.api.ModInitializer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class {{input.name}} implements ModInitializer {
    public static final String MOD_ID = "{{input.modId}}";

    // It is best practice to name the logger after the mod id, so it is clear which mod wrote a line.
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("{{input.title|java}} loaded");
    }
}
