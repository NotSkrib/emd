package {{input.package}};

import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;

// This class does not load on dedicated servers, so client-only code is safe here.
@Mod(value = {{input.name}}.MODID, dist = Dist.CLIENT)
// EventBusSubscriber registers every static method in this class that is annotated with @SubscribeEvent.
@EventBusSubscriber(modid = {{input.name}}.MODID, value = Dist.CLIENT)
public class {{input.name}}Client {

    @SubscribeEvent
    static void onClientSetup(FMLClientSetupEvent event) {
        {{input.name}}.LOGGER.info("{} client setup", {{input.name}}.MODID);
    }
}
