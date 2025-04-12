import { run, bench, boxplot, summary } from "mitata";
import { CacheClient } from "..";

const cache = await CacheClient.init();

bench("getValueFromCacheNull", () =>
  cache.getValueOrRetrieve(
    "benchNull",
    async () => {
      return null;
    },
    {
      duration: 100,
    }
  )
);

bench("getValueFromCacheString", () =>
  cache.getValueOrRetrieve(
    "benchString",
    async () => {
      return "Hello World";
    },
    {
      duration: 100,
    }
  )
);

bench("getValueFromCacheBoolean", () =>
  cache.getValueOrRetrieve(
    "benchBoolean",
    async () => {
      return false;
    },
    {
      duration: 100,
    }
  )
);

bench("getValueFromCacheObject", () =>
  cache.getValueOrRetrieve(
    "benchObject",
    async () => {
      return {
        foo: "bar",
      };
    },
    {
      duration: 100,
    }
  )
);

// boxplot(() => {
//   summary(() => {
//     bench("Array.from($size)", function* (state) {
//       const size = state.get("size");
//       yield () => Array.from({ length: size });
//     }).range("size", 1, 1024);
//   });
// });

await run();
