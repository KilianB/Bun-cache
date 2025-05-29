import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { CacheClient } from "..";

describe("getSetValue", async () => {
  let cacheClient: CacheClient;

  beforeAll(async () => {
    cacheClient = await CacheClient.create();
  });

  afterAll(async () => {
    cacheClient.close();
  });

  test("setNumber", async () => {
    const key = "value_number";

    await cacheClient.del(key);
    await cacheClient.setValue(key, 10);

    const res = await cacheClient.getValue(key);
    await cacheClient.del(key);

    expect(res).toBe(10);
  });

  test("setNumberAsString", async () => {
    const key = "value_number_string";

    await cacheClient.del(key);
    await cacheClient.setValue(key, "10");

    const res = await cacheClient.getValue(key);
    await cacheClient.del(key);

    expect(res).toBe(10);
  });

  test("setTTL", async () => {
    const key = "value_number_TTL";

    await cacheClient.del(key);
    await cacheClient.setValue(key, 10, "EX", 1);

    const preTTL = await cacheClient.getValue(key);

    await Bun.sleep(1050);

    const postTTL = await cacheClient.getValue(key);
    expect(preTTL).toBe(10);
    expect(postTTL).toBe(null);
  });

  test("existsDelete", async () => {
    const key = "existsDelete";

    await cacheClient.del(key);

    expect(await cacheClient.exists(key)).toBe(false);

    await cacheClient.setValue(key, "value");

    expect(await cacheClient.exists(key)).toBe(true);

    await cacheClient.del(key);

    expect(await cacheClient.exists(key)).toBe(false);
  });
});
