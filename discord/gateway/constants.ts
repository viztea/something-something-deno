import { v10 } from "../deps.ts";

export const UNRECOVERABLE_CLOSE_CODES = [
    1005,
    // 1006,
    v10.GatewayCloseCodes.AuthenticationFailed,
    v10.GatewayCloseCodes.InvalidShard,
    v10.GatewayCloseCodes.InvalidIntents,
    v10.GatewayCloseCodes.ShardingRequired,
    v10.GatewayCloseCodes.DisallowedIntents,
];

export const closeReasons = {
    [v10.GatewayCloseCodes.UnknownOpcode]: [
        "lifecycle", "gateway received an invalid opcode..."
    ],
    [v10.GatewayCloseCodes.DecodeError]: [
        "ws", "gateway received an invalid message..."
    ],
    [v10.GatewayCloseCodes.NotAuthenticated]: [
        "lifecycle", "session wasn't authenticated."
    ],
    [v10.GatewayCloseCodes.AuthenticationFailed]: [
        "lifecycle", "authentication failed, destroying all shards..."
    ],
    [v10.GatewayCloseCodes.AlreadyAuthenticated]: [
        "lifecycle", "this shard has already been authenticated."
    ],
    [v10.GatewayCloseCodes.RateLimited]: [
        "lifecycle", "rate-limited? report this to the devs"
    ],
    [v10.GatewayCloseCodes.SessionTimedOut]: [
        "lifecycle", "session has timed out."
    ],
    [v10.GatewayCloseCodes.InvalidShard]: [
        "lifecycle", "an invalid shard was specified."
    ],
    [v10.GatewayCloseCodes.ShardingRequired]: [
        "lifecycle", "sharding is required."
    ],
    [v10.GatewayCloseCodes.InvalidAPIVersion]: [
        "lifecycle", "an invalid api version was passed."
    ],
    [v10.GatewayCloseCodes.InvalidIntents]: [
        "lifecycle", "invalid intents were specified."
    ],
    [v10.GatewayCloseCodes.DisallowedIntents]: [
        "lifecycle", "disallowed intents were specified"
    ],
}
