import "https://deno.land/std@0.167.0/dotenv/load.ts";

import { v10 } from "./discord/deps.ts";
import { createShard } from "./discord/gateway/shard_impl.ts";
import { yellow } from "https://deno.land/std@0.167.0/fmt/colors.ts";

const shard = createShard({
    token: Deno.env.get("DISCORD_TOKEN")!,
    events: {
        debug: (category, ...msg) => console.debug(yellow(`[${category}]`), ...msg),
        error: console.error
    }
});

shard.connect({
    // compress: false,
    presence: {
        status: v10.PresenceUpdateStatus.Online,
        activities: [
            {
                name: "gateway messages",
                type: v10.ActivityType.Listening,
            }
        ],
        since: Date.now(),
        afk: true,
    },
    properties: {
        browser: "Kyu",
        device: "Kyu",
        os: "Android",
    }
});

for await (const dispatch of shard.dispatch) {
    switch (dispatch.t) {
        case v10.GatewayDispatchEvents.Ready: {
            console.log(`${dispatch.d.user.username}#${dispatch.d.user.discriminator} is now online!`);
            break;
        }
    }
}
