/**
 * @file A key value lookup store to quickly save and retrieve data.
 * Information can be saved for a specific period of time and is hold in cache
 * for quicker access time.
 * Serialization to disk can be configured to enable persistence between sessions.
 * Values should be saved in the cacheDb instead of regular sql databases if lookup
 * time is important and relational behavior is not given.
 *
 * Implementation details: A lookup to the cache db is about 2 ms faster compared to to mysql for simple select queries.
 * A redis server is required to run on the local machine.
 * ````sh
 *  # start redis sever
 *  redis-server
 *
 *  # inspect commands
 *  redis-cli
 *  MONITOR
 * ````
 *
 * @author Kilian Brachtendorf - Kilian@brachtendorf.dev
 */

import { RedisClient } from "bun";
import { envOptional } from "ensure-config";

//Milliseconds conversion factor
export const SECONDS = 1000;
export const MINUTES = 60 * SECONDS; //60000;
export const HOURS = 60 * MINUTES; //3600000;
export const DAYS = 24 * HOURS; //86400000

//Used to represent a null value
const NULL_SYMBOL = "%__NULL__%"; //Symbol.for("%__NULL__%");

interface SetValueFunction {
  (key: string, value: unknown): Promise<"OK">;
  /**
   * Set key to hold the string value with expiration
   * @param key The key to set
   * @param value The value to set
   * @param ex Set the specified expire time, in seconds
   * @returns Promise that resolves with "OK" on success
   */
  (key: string, value: unknown, ex: "EX", seconds: number): Promise<"OK">;
  /**
   * Set key to hold the string value with expiration
   * @param key The key to set
   * @param value The value to set
   * @param px Set the specified expire time, in milliseconds
   * @returns Promise that resolves with "OK" on success
   */
  (key: string, value: unknown, ex: "PX", milliseconds: number): Promise<"OK">;

  /**
   * Set key to hold the string value with expiration at a specific Unix timestamp
   * @param key The key to set
   * @param value The value to set
   * @param exat Set the specified Unix time at which the key will expire, in seconds
   * @returns Promise that resolves with "OK" on success
   */
  (
    key: string,
    value: unknown,
    exat: "EXAT",
    timestampSeconds: number
  ): Promise<"OK">;

  /**
   * Set key to hold the string value with expiration at a specific Unix timestamp
   * @param key The key to set
   * @param value The value to set
   * @param pxat Set the specified Unix time at which the key will expire, in milliseconds
   * @returns Promise that resolves with "OK" on success
   */
  (
    key: string,
    value: unknown,
    ex: "PXAT",
    timestampMilliseconds: number
  ): Promise<"OK">;

  /**
   * Set key to hold the string value only if key does not exist
   * @param key The key to set
   * @param value The value to set
   * @param nx Only set the key if it does not already exist
   * @returns Promise that resolves with "OK" on success, or null if the key already exists
   */
  (key: string, value: unknown, nx: "NX"): Promise<"OK" | null>;
  /**
   * Set key to hold the string value only if key already exists
   * @param key The key to set
   * @param value The value to set
   * @param xx Only set the key if it already exists
   * @returns Promise that resolves with "OK" on success, or null if the key does not exist
   */
  (key: string, value: unknown, xx: "XX"): Promise<"OK" | null>;
  /**
   * Set key to hold the string value and return the old value
   * @param key The key to set
   * @param value The value to set
   * @param get Return the old string stored at key, or null if key did not exist
   * @returns Promise that resolves with the old value, or null if key did not exist
   */
  (key: string, value: unknown, get: "GET"): Promise<"OK" | null>;
  /**
   * Set key to hold the string value and retain the time to live
   * @param key The key to set
   * @param value The value to set
   * @param keepttl Retain the time to live associated with the key
   * @returns Promise that resolves with "OK" on success
   */
  (key: string, value: unknown, keepttl: "KEEPTTL"): Promise<"OK">;
  //   /**
  //    * Set key to hold the string value with various options
  //    * @param key The key to set
  //    * @param value The value to set
  //    * @param options Array of options (EX, PX, EXAT, PXAT, NX, XX, KEEPTTL, GET)
  //    * @returns Promise that resolves with "OK" on success, null if NX/XX condition not met, or the old value if GET is specified
  //    */
  (key: string, value: unknown, ...options: string[]): Promise<"OK" | null>;
}

export interface BaseCacheClientOptions extends Bun.RedisOptions {
  url?: string;
  getValueOrRetrieveDefaultOptions?: {
    /**
     * The global cache duration for values retrieved via the `getValueOrRetrieve` method.
     * This value can be overwritten per request by passing an option to `getValueOrRetrieve`.
     * @default minutes
     */
    cacheDurationInMs?: number;
    /**
     * Identifier prepended to the key saved in redis.
     *
     * @default ''
     */
    keyPrefix?: string;
  };
}

export interface WaitForConnectionCacheClientOptions
  extends BaseCacheClientOptions {
  /**
   * If not supplied or true wait for until the a successful connection to redis has been established.
   *
   * @example const client = await CacheClient.create();
   *
   */
  waitForConnection?: true;
}

export interface ConnectionCacheClientOptions extends BaseCacheClientOptions {
  /**
   * If not supplied or true wait for until the a successful connection to redis has been established.
   *
   * @example const client = await CacheClient.create({
   *    waitForConnection: false
   *    onConnection(err => {
   *        if(err){
   *            console.error("Could not connect to redis", err);
   *        }
   *    })
   * });
   *
   */
  waitForConnection: false;
  onConnection: (err?: Error) => void;
}

export interface CacheOption {
  /**
   * The cache duration of the key. If not supplied fall backs to 5 Minutes.
   * This option takes precedence over the default defined in the `CacheClient.create()`
   */
  duration?:
    | {
        value: number;
        unit: "MILLISECONDS" | "SECONDS" | "MINUTES" | "HOURS" | "DAYS";
      }
    | number;
  /**
   * Automatically reset the cache duration when a valid value is accessed
   * Defaults to false
   */
  renewCacheDurationOnAccess?: boolean;

  /**
   * If set to true responses of null returned by the retrieval function are considered to be a valid
   * return value and will be cached in redis
   * Defaults to true
   */
  saveNullResponse?: boolean;

  /**
   * If set always request a fresh copy of the data and save it in the cache.
   */
  bypassCache?: boolean;
}

// interface GetValueFromCache {
//   (
//     key: string,
//     retrieve: RetrievalFunction<T>,
//     options: CacheOption
//   ): Promise<T>;
// }

export type RetrievalFunction<T> = () => Promise<T | null> | T;

/**
 * A client for interacting with a Redis-backed cache.
 *
 * The `CacheClient` provides methods for setting, retrieving, and managing cached values,
 * including support for automatic retrieval and caching of values, cache expiration,
 * key prefixing, transactions, and connection management.
 *
 * Use `CacheClient.create()` to instantiate a new client, optionally waiting for a connection.
 *
 * Example usage:
 * ```typescript
 * const cache = await CacheClient.create({ url: "redis://localhost:6379" });
 * await cache.setValue("key", { foo: "bar" });
 * const value = await cache.getValue<{ foo: string }>("key");
 * ```
 *
 * @public
 */
export class CacheClient {
  public client: RedisClient;
  private url: string;

  //Get value or retrieve default values
  private getValueOrRetrieveCacheDurationInMs: number;
  private getValueOrRetrieveKeyPrefix: string;

  private constructor(options?: BaseCacheClientOptions) {
    if (options?.url) {
      this.url = options.url;
    } else {
      const url = envOptional("REDIS_URL");
      if (!url) {
        throw new Error(
          "Either supply a url to the cache client constructor or set the REDIS_URL env variable"
        );
      }
      this.url = url;
    }

    if (options?.getValueOrRetrieveDefaultOptions?.cacheDurationInMs) {
      this.getValueOrRetrieveCacheDurationInMs =
        options.getValueOrRetrieveDefaultOptions.cacheDurationInMs;
    } else {
      this.getValueOrRetrieveCacheDurationInMs = 5 * MINUTES;
    }

    if (options?.getValueOrRetrieveDefaultOptions?.keyPrefix) {
      this.getValueOrRetrieveKeyPrefix =
        options.getValueOrRetrieveDefaultOptions.keyPrefix;
    } else {
      this.getValueOrRetrieveKeyPrefix = "";
    }

    if (options) {
      const { url, ...restOptions } = options;
      this.client = new RedisClient(this.url, restOptions);
    } else {
      this.client = new RedisClient(this.url);
    }
  }

  static create(
    options?: WaitForConnectionCacheClientOptions
  ): Promise<CacheClient>;
  static create(options: ConnectionCacheClientOptions): CacheClient;
  static create(
    options?: WaitForConnectionCacheClientOptions | ConnectionCacheClientOptions
  ): Promise<CacheClient> | CacheClient {
    if (
      options &&
      "waitForConnection" in options &&
      options.waitForConnection === false
    ) {
      const instance = new CacheClient(options);

      instance.client
        .connect()
        .then(() => {
          options.onConnection();
        })
        .catch((err) => {
          options.onConnection(err);
        });

      return instance;
    }

    const instance = new CacheClient(options);
    return instance.client.connect().then(() => {
      return instance;
    });
  }

  /**
   * Sets a value serializing non-string values as JSON.
   *
   * @param key - The key under which the value will be stored.
   * @param value - The value to store. If not a string, it will be stringified as JSON.
   * @param options - Additional options to pass to the client's set method (such as expiration time or flags).
   * @returns The result of the underlying client's set operation.
   */
  setValue: SetValueFunction = (
    key,
    value,
    ...options: (string | number)[]
  ) => {
    // lastArg?: number
    if (typeof value !== "string") {
      //@ts-expect-error typings are impossible to implement cleanly
      return this.client.set(key, JSON.stringify(value), ...options);
    }

    if (options) {
      //@ts-expect-error typings are impossible to implement cleanly
      return this.client.set(key, value as string, ...options);
      // biome-ignore lint/style/noUselessElse: <explanation>
    } else {
      return this.client.set(key, value as string);
    }
  };

  /**
   * Retrieves a value from the cache by its key.
   *
   * @param {string} key - The key to retrieve the value for.
   * @param {boolean} [raw] - If true, returns the raw string value saved in redis without parsing. If false or omitted, attempts to parse the value as JSON. Values that could be deserialized as numeric values will be returned as such even if they have been saved as strings.
   * @returns {Promise<T | string | null>} A promise that resolves to the parsed value, or null if the key does not exist or the client is not connected.
   *
   * @remarks
   * - If the value is not found or the client is not connected, returns null.
   */
  getValue: GetValueFunction = async <T extends object>(
    key: string,
    raw?: boolean
  ): Promise<T | string | null> => {
    if (this.client.connected) {
      const value = await this.client.get(key);
      if (raw || value === null) {
        return value;
      }
      //eventually use he/decode for html values.
      try {
        return JSON.parse(value) as T;
      } catch {
        // throw new Error(`Failed to decode value for redis key ${key}`);
        return value;
      }
    }
    return null;
  };

  private cacheTimeInMS(duration?: CacheOption["duration"]): number {
    if (!duration) {
      return this.getValueOrRetrieveCacheDurationInMs;
    }

    if (typeof duration === "number") {
      return duration;
    }
    switch (duration.unit) {
      case "MILLISECONDS":
        return duration.value;
      case "SECONDS":
        return SECONDS * duration.value;
      case "MINUTES":
        return MINUTES * duration.value;
      case "HOURS":
        return HOURS * duration.value;
      case "DAYS":
        return HOURS * duration.value;
    }
  }

  async getValueOrRetrieve<T>(
    key: string | unknown[],
    retrieve: RetrievalFunction<T>,
    options?: CacheOption
  ): Promise<T | null> {
    const computedKey = this.computeCacheKey(key);

    const expirationTime = this.cacheTimeInMS(options?.duration) / SECONDS;

    if (options?.bypassCache !== true) {
      const value = await this.client.get(computedKey);

      if (
        value &&
        (value !== NULL_SYMBOL || options?.saveNullResponse !== false)
      ) {
        //Renew expiration time
        if (options?.renewCacheDurationOnAccess) {
          await this.client.expire(computedKey, expirationTime).catch((e) => {
            console.warn(`Could not renew cache duration of key ${key} ${e}`);
          });
        }

        if (value === NULL_SYMBOL) {
          return null;
        }

        //These are all wrapping
        return JSON.parse(value) as T;
      }
    }

    //Value needs to be retrieved;

    const fetchedValue = await retrieve();

    if (fetchedValue === null) {
      if (options?.saveNullResponse !== false) {
        await this.client.set(computedKey, NULL_SYMBOL);
      }
      return null;
    }

    await this.client.set(
      computedKey,
      JSON.stringify(fetchedValue),
      "EX",
      expirationTime
    );
    return fetchedValue;
  }

  private computeCacheKey = (input: string | unknown[]): string => {
    let key = this.getValueOrRetrieveKeyPrefix;

    if (typeof input === "string") {
      return key + input;
    }
    for (const i of input) {
      key += `_${i}`;
    }
    return key;
  };

  async transaction(callback: (tx: CacheClient) => Promise<void>) {
    const tempClient = await CacheClient.create({
      url: this.url,
    });

    //We currently do not have proper pipelining here. Reconnect with a separate client to enforce that we do not halt invocations on other redis calls if we are awaiting in between;
    tempClient.client.send("MULTI", []);

    try {
      await callback(tempClient);
      await tempClient.client.send("EXEC", []);
    } catch (e) {
      tempClient.client.send("DISCARD", []);
      throw e;
    }
  }

  //Not really worth it. We have a ~5% performance improvement for the tradeoff of no guarantee of the 2nd call being cached in at least the same event loop tick.
  // async getValueOrRetrieveFast<T>(
  //   key: string,
  //   retrieve: RetrievalFunction<T>,
  //   options?: CacheOption
  // ): Promise<T | null> {
  //   const value = await this.client.get(key);
  //   const expirationTime = this.cacheTimeInMS(options?.duration) / SECONDS;

  //   if (
  //     value &&
  //     (value !== NULL_SYMBOL || options?.saveNullResponse !== false)
  //   ) {
  //     //Renew expiration time
  //     if (options?.renewCacheDurationOnAccess) {
  //       this.client.expire(key, expirationTime).catch((e) => {
  //         console.warn(`Could not renew cache duration of key ${key} ${e}`);
  //       });
  //     }

  //     if (value === NULL_SYMBOL) {
  //       return null;
  //     }

  //     //These are all wrapping
  //     return JSON.parse(value) as T;
  //   }

  //   //Value needs to be retrieved;

  //   const fetchedValue = await retrieve();

  //   if (fetchedValue === null) {
  //     if (options?.saveNullResponse !== false) {
  //       this.client.set(key, NULL_SYMBOL);
  //     }
  //     return null;
  //   }

  //   this.client.set(key, JSON.stringify(fetchedValue), "EX", expirationTime);
  //   return fetchedValue;
  // }

  [Symbol.dispose] = () => {
    this.close();
  };

  /**
   * Disconnect from the Redis server
   */
  close = () => {
    this.client.close();
  };

  //Do we connect the listeners here?

  //Expose underlying val key impl

  /**
   * Delete a key
   * @param key The key to delete
   * @returns Promise that resolves with the number of keys removed
   */
  del(key: string): Promise<number> {
    return this.client.del(key);
  }

  /**
   * Determine if a key exists
   * @param key The key to check
   * @returns Promise that resolves with true if the key exists, false otherwise
   */
  exists(key: string): Promise<boolean> {
    return this.client.exists(key);
  }

  /**
   * Callback fired when the client connects to the Redis server
   */
  onconnect(cb: (this: CacheClient) => void) {
    this.client.onconnect = () => {
      cb.bind(this)();
    };
  }

  /**
   * Callback fired when the client disconnects from the Redis server
   * @param error The error that caused the disconnection
   */
  onclose(cb: (this: CacheClient, error: Error) => void) {
    this.client.onclose = (err) => {
      cb.bind(this)(err);
    };
  }

  //   /**
  //    * Count the number of set bits (population counting) in a string
  //    * @param key The key to count bits in
  //    * @returns Promise that resolves with the number of bits set to 1
  //    */
  //   bitcount(key: string): Promise<number> {
  //     return this.client.bitcount(key);
  //   }
}

type GetValueFunction = {
  <T>(key: string): Promise<T | null>;
  (key: string, raw: boolean): Promise<string | null>;
};
