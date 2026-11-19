import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/store/engine";
import { createMemoryRepository } from "@/lib/store/memory";
import type { Repository, Result } from "@/types/store";

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`esperava ok, veio ${result.error}`);
  return result.value;
};

/**
 * Repositório que simula outra pessoa gravando a mesma mesa logo depois de cada leitura,
 * nas `interruptions` primeiras gravações.
 */
const racingRepository = (interruptions: number) => {
  const base = createMemoryRepository();
  let remaining = interruptions;
  let saves = 0;
  const repo: Repository = {
    ...base,
    async saveSession(sessionId, expectedVersion, changes, event) {
      saves += 1;
      if (remaining > 0) {
        remaining -= 1;
        // A "outra pessoa" grava antes: a versão esperada fica velha.
        await base.saveSession(sessionId, expectedVersion, {}, null);
      }
      return base.saveSession(sessionId, expectedVersion, changes, event);
    },
  };
  return { repo, saves: () => saves };
};

const openTableWithTab = async (repo: Repository) => {
  const store = createStore(repo);
  const session = unwrap(await store.openSession("mesa-1", "1234", "waiter"));
  return { store, session };
};

describe("createStore com controle de versão", () => {
  it("relê a mesa e repete quando outra gravação chegou antes", async () => {
    const { repo, saves } = racingRepository(1);
    const { store, session } = await openTableWithTab(repo);
    const tab = unwrap(await store.createTab({ sessionId: session.id, customerName: "Ana", peopleCount: 1 }, "customer"));
    expect(saves()).toBe(2);
    const snapshot = unwrap(await store.getSessionSnapshot(session.id));
    expect(snapshot.tabs.map((entry) => entry.id)).toEqual([tab.id]);
  });

  it("desiste com conflict depois de várias tentativas seguidas", async () => {
    const { repo } = racingRepository(10);
    const { store, session } = await openTableWithTab(repo);
    const result = await store.createTab({ sessionId: session.id, customerName: "Ana", peopleCount: 1 }, "customer");
    expect(result).toEqual({ ok: false, error: "conflict" });
    expect(unwrap(await store.getSessionSnapshot(session.id)).tabs).toEqual([]);
  });

  it("não grava nada (nem a versão) quando o comando é recusado", async () => {
    const repo = createMemoryRepository();
    const { store, session } = await openTableWithTab(repo);
    const before = (await repo.loadSession(session.id))?.version;
    await store.createTab({ sessionId: session.id, customerName: "   ", peopleCount: 1 }, "customer");
    expect((await repo.loadSession(session.id))?.version).toBe(before);
    expect((await store.getEvents(0)).lastSeq).toBe(1);
  });

  it("grava só a tentativa de código errado, sem evento", async () => {
    const repo = createMemoryRepository();
    const { store, session } = await openTableWithTab(repo);
    await store.verifyJoinCode(session.id, "0000");
    expect((await repo.loadSession(session.id))?.secret.failedAttempts).toBe(1);
    expect((await store.getEvents(0)).lastSeq).toBe(1);
  });
});
