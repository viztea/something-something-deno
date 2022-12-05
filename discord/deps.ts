import type Pako from "npm:@types/pako@latest";

export * as v10 from "https://deno.land/x/discord_api_types@0.37.19/v10.ts"

export * as ws from "https://deno.land/x/pogsocket@2.0.0/mod.ts";

export { inflate } from "https://deno.land/x/compress@v0.4.5/zlib/mod.ts";

export { JsonParseStream } from "https://deno.land/std@0.167.0/encoding/json/stream.ts";

export * from "../deps.ts";

export const zlib: {
    Inflate: typeof Pako.Inflate;
} = await import("npm:pako@latest");

// deno-lint-ignore no-namespace
export namespace zlib {
    export type Inflate = Pako.Inflate;
}
