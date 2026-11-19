import { createMemoryStore } from "@/lib/store/memory";
import { describeStoreContract } from "@/lib/store/store-contract";

describeStoreContract((options) => createMemoryStore(options));
