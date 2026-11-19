import { describe, expect, it } from "vitest";
import {
  CALL_REASON_LABEL,
  CALL_STATUS_LABEL,
  ITEM_STATUS_LABEL,
  STATION_LABEL,
  TAB_STATUS_LABEL,
} from "@/lib/labels";

describe("labels", () => {
  it("tem um texto diferente e não vazio para cada estado", () => {
    for (const labels of [ITEM_STATUS_LABEL, TAB_STATUS_LABEL, CALL_REASON_LABEL, CALL_STATUS_LABEL, STATION_LABEL]) {
      const values = Object.values(labels);
      expect(values.every((value) => value.trim().length > 0)).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("cobre todos os estados do item", () => {
    expect(Object.keys(ITEM_STATUS_LABEL).sort()).toEqual(
      ["awaiting_approval", "canceled", "delivered", "picked_up", "preparing", "ready", "sent"].sort(),
    );
  });
});
