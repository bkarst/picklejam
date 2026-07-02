// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { ContactForm } from "@/app/contact/ContactForm";

function fill(name: string, email: string, message: string) {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: message } });
}

describe("<ContactForm>", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("posts name/email/message to /api/contact and shows success", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    render(<ContactForm />);
    fill("Jamie Pickle", "jamie@example.com", "I would love more courts near me please.");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/contact");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Jamie Pickle",
      email: "jamie@example.com",
      message: "I would love more courts near me please.",
    });

    expect(await screen.findByText(/on its way/i)).toBeInTheDocument();
  });

  it("validates email client-side before calling the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<ContactForm />);
    fill("Jamie", "not-an-email", "This is a valid length message.");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a non-trivial message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<ContactForm />);
    fill("Jamie", "jamie@example.com", "short");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 10 characters/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a retryable error when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(<ContactForm />);
    fill("Jamie", "jamie@example.com", "I would love more courts near me please.");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    // The form is still there to retry.
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<ContactForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
