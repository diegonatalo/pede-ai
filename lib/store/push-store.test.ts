import { createMemoryPushStore } from "@/lib/store/memory";
import { describePushStoreContract } from "@/lib/store/push-contract";

describePushStoreContract(() => createMemoryPushStore());
