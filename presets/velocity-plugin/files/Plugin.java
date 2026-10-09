package {{input.package}};

import com.google.inject.Inject;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.proxy.ProxyServer;
import org.slf4j.Logger;

public final class {{input.name}} {

    private final ProxyServer server;
    private final Logger logger;

    @Inject
    public {{input.name}}(final ProxyServer server, final Logger logger) {
        this.server = server;
        this.logger = logger;
    }

    @Subscribe
    public void onProxyInitialization(final ProxyInitializeEvent event) {
        logger.info("{{input.name}} enabled on {}", server.getVersion().getName());
    }
}
