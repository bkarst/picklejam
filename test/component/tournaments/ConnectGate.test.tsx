// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConnectGate } from "@/components/tournaments/ConnectGate";

/**
 * <ConnectGate> — blocks the publish surface until Stripe Connect is complete
 * (§10). Presentational, so it's driven directly by `ready`/`status`. The gated
 * children (here a Publish button) must NOT render until `ready`.
 */
const Publish = () => <button type="button">Publish tournament</button>;

describe("<ConnectGate>", () => {
  it("hides the publish action and offers Connect payouts when not ready", () => {
    render(
      <ConnectGate ready={false} status="none" onStartConnect={() => {}}>
        <Publish />
      </ConnectGate>,
    );
    expect(screen.getByRole("button", { name: "Connect payouts" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish tournament" })).not.toBeInTheDocument();
  });

  it("reveals the publish action once ready", () => {
    render(
      <ConnectGate ready status="complete" onStartConnect={() => {}}>
        <Publish />
      </ConnectGate>,
    );
    expect(screen.getByRole("button", { name: "Publish tournament" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect payouts/i })).not.toBeInTheDocument();
  });

  it("says Continue setup when onboarding is partially done", () => {
    render(
      <ConnectGate ready={false} status="pending" onStartConnect={() => {}}>
        <Publish />
      </ConnectGate>,
    );
    expect(screen.getByRole("button", { name: "Continue setup" })).toBeInTheDocument();
  });

  it("fires onStartConnect and shows a busy label", () => {
    const onStart = vi.fn();
    const { rerender } = render(
      <ConnectGate ready={false} status="none" onStartConnect={onStart}>
        <Publish />
      </ConnectGate>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect payouts" }));
    expect(onStart).toHaveBeenCalledOnce();

    rerender(
      <ConnectGate ready={false} status="none" isConnecting onStartConnect={onStart}>
        <Publish />
      </ConnectGate>,
    );
    expect(screen.getByRole("button", { name: "Redirecting…" })).toBeDisabled();
  });

  it("does not reveal children while loading", () => {
    render(
      <ConnectGate ready={false} isLoading onStartConnect={() => {}}>
        <Publish />
      </ConnectGate>,
    );
    expect(screen.queryByRole("button", { name: "Publish tournament" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect payouts/i })).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ConnectGate ready={false} status="restricted" onStartConnect={() => {}}>
        <Publish />
      </ConnectGate>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
