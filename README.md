# BUN-CACHE

A cache wrapper around the [Bun Redis Client](https://bun.sh/docs/api/redis), providing ergonomic utilities for caching, serialization, transactions and cache management. Supports Valkey and is designed for fast, type-safe caching in Bun projects.

## Features

- Simple API for setting and retrieving values
- Automatic JSON serialization/deserialization
- Support for numbers, strings, booleans, objects, and `null`
- Flexible cache duration and key prefixing
- Transaction support
- Key deletion and existence checks
- Connection lifecycle hooks

## Installation

```sh
bun add bun-cache
```

## Quick Start

```typescript
import { CacheClient } from "bun-cache";

const client = await CacheClient.create();

await client.setValue("Hello", "World");
await client.setValue("KeyWithTTL", "Value", "EX", 40); // 40 seconds TTL

const value = await client.getValue("Hello"); // "World"
const valueWithTTL = await client.getValue("KeyWithTTL"); // "Value"
```

A url can be set by either setting the `REDIS_URL` environmental variable or passing the url to the initializer function

```typescript
const client = await CacheClient.create({
  url: "redis://localhost:6379",
});
```

## Utility Functions

### getValueOrRetrieve

`getValueOrRetrieve` implements a cache-aside pattern: it checks the cache for a value, and if not present, calls your async retriever function, caches the result, and returns it.

```typescript
const language = "de";

const vehiclesForLanguage = await client.getValueOrRetrieve(
  ["vehicles", language],
  async () => {
    return postgres.getVehicles(language);
  }
);
```

- **CacheKey**: Can be a string or array. Arrays are joined to form a unique key.
- **RetrievalFunction**: An async function returning the value to cache if not present.

#### Cache Duration

By default, values are cached for 5 minutes. You can override this per call:

```typescript
await client.getValueOrRetrieve(
  "shortLivedKey",
  async () => fetchData(),
  { duration: { value: 10, unit: "SECONDS" } }
  //Or supply a value in milliseconds {duration: 10 * SECONDS}
);
```

Or globally in the constructor of the client

```typescript
const client = await CacheClient.create({
  getValueOrRetrieveDefaultOptions: {
    cacheDurationInMs: 10 * MINUTES, // 10 minutes
  },
});
```

#### Null Handling

By default, `null` results are cached. To skip caching nulls:

```typescript
await client.getValueOrRetrieve("maybeNull", async () => possiblyNullValue(), {
  saveNullResponse: false,
});
```

#### Renew Cache Duration on Access

To automatically reset the cache duration when a value is accessed: Setting this option might potentially result in values to never be renewed if access happens frequently.

```typescript
await client.getValueOrRetrieve("renewKey", async () => fetchData(), {
  renewCacheDurationOnAccess: true,
});
```

### setValue

Set a value in the cache. Supports JSON serialization for objects and numbers.

```typescript
await client.setValue("key", { foo: "bar" });
await client.setValue("key2", 123);
await client.setValue("key3", "value", "EX", 60); // 60 seconds TTL
```

### getValue

Retrieve a value from the cache. Automatically parses JSON if possible.

```typescript
const obj = await client.getValue<{ foo: string }>("key");
const num = await client.getValue<number>("key2");
const raw = await client.getValue("key3", true); // returns raw string
```

**Caution** : String values which are parsable as a number will be returned as a number. To prevent this set the 2nd parameter to true.

## Transactions

Run multiple cache operations in a transaction. All actions inside the callback will be executed atomically. If an error is thrown

```typescript
await client.transaction(async (tx) => {
  await tx.setValue("a", 1);
  await tx.setValue("b", 2);
});
```

## API Reference

### del

Delete a key from the cache.

```typescript
await client.del("key");
```

### exists

Check if a key exists in the cache.

```typescript
const exists = await client.exists("key"); // true or false
```

### Connection Lifecycle

You can hook into connection and disconnection events:

```typescript
client.onconnect(() => {
  console.log("Connected to Redis!");
});

client.onclose((err) => {
  console.log("Disconnected from Redis", err);
});
```

### Close Connection

Always close the client when done:

```ts
client.close();
```

Disposable

```ts
{
    using client = await CacheClient.create();
}
```

## Advanced Options

You can directly access the low level bun redis client.

```ts
await cacheClient.client.send("COMMAND", []);
```

For more details, see the [Bun Redis documentation](https://bun.sh/docs/api/redis).
