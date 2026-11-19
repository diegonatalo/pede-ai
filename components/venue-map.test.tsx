import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VenueMap } from "@/components/venue-map";
import { MAP_SPOTS, TABLES } from "@/lib/seed-data";

describe("VenueMap", () => {
  it("diz em palavras onde fica a mesa e os pontos do salão", () => {
    render(<VenueMap spots={MAP_SPOTS} tables={TABLES} highlightTableId="mesa-3" />);
    expect(screen.getByText("Sua mesa: Mesa 3, no meio do salão.")).toBeInTheDocument();
    expect(screen.getByText("Banheiros:").parentElement).toHaveTextContent("Banheiros: ao fundo, à direita.");
    expect(screen.getByText("Caixa:").parentElement).toHaveTextContent("Caixa: perto da entrada, à esquerda.");
  });

  it("marca a mesa do cliente no desenho", () => {
    const { container } = render(<VenueMap spots={MAP_SPOTS} tables={TABLES} highlightTableId="mesa-3" />);
    expect(container.querySelectorAll("rect")).toHaveLength(MAP_SPOTS.length);
    expect([...container.querySelectorAll("text")].map((node) => node.textContent)).toContain("Você");
    // Só a mesa do cliente tem a cor de destaque, e sem a cor comum junto (uma anularia a outra).
    const highlighted = [...container.querySelectorAll("rect")].filter((rect) =>
      rect.classList.contains("fill-accent"),
    );
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].getAttribute("class")).not.toContain("fill-card");
    // O desenho fica fora da árvore de acessibilidade: a lista em texto já diz o mesmo.
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("funciona sem mesa em destaque", () => {
    render(<VenueMap spots={MAP_SPOTS} tables={TABLES} />);
    expect(screen.queryByText(/Sua mesa/)).not.toBeInTheDocument();
    expect(screen.getByText("Cozinha:")).toBeInTheDocument();
  });
});
