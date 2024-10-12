export type RequiredKeys<T, REQUIRE extends keyof T> = Required<Pick<T, REQUIRE>> & Pick<T, Exclude<keyof T, REQUIRE>>;

export type Nullable<T> = T | null;

export type Awaitable<T> = PromiseLike<T> | T;

export type uint16 = number;

export type uint32 = number;
