import type { Actor, Role } from "@/types/domain";

export const roleOf = (actor: Actor): Role => (typeof actor === "string" ? actor : actor.role);

export const staffIdOf = (actor: Actor): string | undefined => (typeof actor === "string" ? undefined : actor.staffId);
