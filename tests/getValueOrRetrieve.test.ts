import { beforeAll, describe, expect, test } from "bun:test";
import { CacheClient } from "..";

describe("getValueOrRetrieve", async () => {
  let cacheClient: CacheClient;

  beforeAll(async () => {
    cacheClient = await CacheClient.create({
      url: "redis://localhost:6379",
    });
  });

  test("Boolean Returned", async () => {
    const key = "testBool";

    await cacheClient.del(key);

    let count = 0;

    const res = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return true;
    });

    expect(res).toBe(true);
    expect(count).toBe(1);

    const res1 = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return false;
    });

    expect(res1).toBe(true);
    expect(count).toBe(1);
  });

  test("Null Returned", async () => {
    const key = "testNull";

    await cacheClient.del(key);

    let count = 0;

    const res = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return null;
    });

    expect(res).toBe(null);
    expect(count).toBe(1);

    const res1 = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return "Hello";
    });

    expect(res1).toBe(null);
    expect(count).toBe(1);
  });

  test("Do not save null", async () => {
    const key = "testSaveNull";

    await cacheClient.del(key);

    let count = 0;

    const res = await cacheClient.getValueOrRetrieve(
      key,
      async () => {
        count++;
        return null;
      },
      {
        saveNullResponse: false,
      }
    );

    expect(res).toBe(null);
    expect(count).toBe(1);

    const res1 = await cacheClient.getValueOrRetrieve(
      key,
      async () => {
        count++;
        return "Hello";
      },
      {
        saveNullResponse: false,
      }
    );

    expect(res1).toBe("Hello");
    expect(count).toBe(2);
  });

  test("Number Returned", async () => {
    const key = "testNumber";

    await cacheClient.del(key);

    let count = 0;

    const res = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return 20;
    });

    expect(res).toBe(20);
    expect(count).toBe(1);

    const res1 = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return 10;
    });

    expect(res1).toBe(20);
    expect(count).toBe(1);
  });

  test("Object Returned", async () => {
    const key = "testObject";

    await cacheClient.del(key);

    let count = 0;

    const res = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return {
        foo: "bar",
      };
    });

    expect(res).toMatchObject({
      foo: "bar",
    });
    expect(count).toBe(1);

    const res1 = await cacheClient.getValueOrRetrieve(key, async () => {
      count++;
      return 10;
    });

    expect(res1).toMatchObject({
      foo: "bar",
    });
    expect(count).toBe(1);
  });
});
