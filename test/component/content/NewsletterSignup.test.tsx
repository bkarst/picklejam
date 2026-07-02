// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { NewsletterSignup } from "@/components/content/NewsletterSignup";

describe("<NewsletterSignup>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the email + source to /api/newsletter and shows success", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    render(<NewsletterSignup source="news" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "player@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/newsletter");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ email: "player@example.com", source: "news" });

    expect(await screen.findByText(/you're on the list/i)).toBeInTheDocument();
  });

  it("validates the email client-side before calling the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<NewsletterSignup source="learn" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a retryable error when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(<NewsletterSignup source="learn" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "player@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    // The form is still there to retry.
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
  });

  it("has no axe violations (band + inline)", async () => {
    const band = render(<NewsletterSignup source="a" />);
    expect(await axe(band.container)).toHaveNoViolations();
    const inline = render(<NewsletterSignup source="b" variant="inline" />);
    expect(await axe(inline.container)).toHaveNoViolations();
  });
});
