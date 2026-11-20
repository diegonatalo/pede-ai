import { createMemoryRateLimiter } from "@/lib/store/memory";
import { describeRateLimiterContract } from "@/lib/store/rate-limit-contract";

describeRateLimiterContract((config) => createMemoryRateLimiter(config));
