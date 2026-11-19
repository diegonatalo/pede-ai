import { createStore } from "@/lib/store/engine";
import { describeIsolationContract } from "@/lib/store/isolation-contract";
import { createMemoryRegistry, createMemoryRepository, createMemoryWorld } from "@/lib/store/memory";

describeIsolationContract(() => {
  const world = createMemoryWorld({ sample: true });
  return {
    registry: createMemoryRegistry(world),
    storeFor: (restaurantId) => createStore(createMemoryRepository(world, restaurantId), { pinKey: world.pinKey }),
  };
});
