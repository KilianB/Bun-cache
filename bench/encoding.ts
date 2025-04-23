import { bench, run, summary } from "mitata";
import { CacheClient } from "..";

const cache = await CacheClient.create();

cache.onclose((err) => {
  console.log("Cache client closed", err);
});

summary(() => {
  bench(
    "getValueOrRetrieve($mode)",
    function* (state: { get(param: string): string }) {
      const n = state.get("mode");

      let i = 10_000;
      // if (n === "not awaited") {
      //   yield async () => {
      //     i++;
      //     await cache.getValueOrRetrieveFast(n + i.toString(), async () => {
      //       return "Fooo";
      //     });
      //   };
      // }
      if (n === "awaited") {
        yield async () => {
          i++;
          await cache.getValueOrRetrieve(n + i.toString(), async () => {
            return "Fooo";
          });
        };
      }

      // }
    }
  ).args("mode", ["awaited", "not awaited"]);
});

// bench('getValueFromCache_$mode',function* (state){

//   const mode =  state.get('mode');

// yiel

// }).args(mode: ['base', 'hardCodedExpiration'])

// bench("getValueFromCacheString", () =>
//   cache.getValueOrRetrieve(
//     "benchString",
//     async () => {
//       return "Hello World";
//     },
//     {
//       duration: 100,
//     }
//   )
// );

// bench("getValueFromCacheBoolean", () =>
//   cache.getValueOrRetrieve(
//     "benchBoolean",
//     async () => {
//       return false;
//     },
//     {
//       duration: 100,
//     }
//   )
// );

// bench("getValueFromCacheObject", () =>
//   cache.getValueOrRetrieve(
//     "benchObject",
//     async () => {
//       return {
//         foo: "bar",
//       };
//     },
//     {
//       duration: 100,
//     }
//   )
// );

// boxplot(() => {
//   summary(() => {
//     bench("Array.from($size)", function* (state) {
//       const size = state.get("size");
//       yield () => Array.from({ length: size });
//     }).range("size", 1, 1024);
//   });
// });

await run();
