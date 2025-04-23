import { bench, run, summary, do_not_optimize } from "mitata";
import { CacheClient } from "..";


{
  using cache = await CacheClient.create();

  cache.setValue("StringValue", "HelloWorld");

  summary(() => {
    bench("GetValueRaw", async() =>
      do_not_optimize(await cache.getValue("StringValue", true))
    ).gc("inner");
    bench("GetValue", async() => do_not_optimize(await cache.getValue("StringValue"))).gc(
      "inner"
    );
  });

  await run();

}