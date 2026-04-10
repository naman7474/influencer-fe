import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Supabase mock ──────────────────────────────────────────────────
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
    },
    from: () => ({
      insert: mockInsert,
    }),
  }),
}));

// ── Next.js navigation mock ────────────────────────────────────────
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

// ── Import pages after mocks ──────────────────────────────────────
import LoginPage from "../login/page";
import SignupPage from "../signup/page";

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields and a submit button", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in$/i })
    ).toBeInTheDocument();
  });

  it("renders Google sign-in button", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it("renders link to signup page", () => {
    render(<LoginPage />);

    const signupLink = screen.getByRole("link", { name: /sign up/i });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute("href", "/signup");
  });

  it("shows error state on failed login", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid login credentials"
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to dashboard on successful login", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "correctpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in$/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});

describe("Signup page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email, password, and brand name fields", () => {
    render(<SignupPage />);

    expect(screen.getByLabelText(/brand name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account$/i })
    ).toBeInTheDocument();
  });

  it("renders link to login page", () => {
    render(<SignupPage />);

    const loginLink = screen.getByRole("link", { name: /sign in/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("shows error on signup failure", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText(/brand name/i), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /create account$/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "User already registered"
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to onboarding on successful signup", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    });
    mockInsert.mockResolvedValueOnce({ error: null });

    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText(/brand name/i), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /create account$/i })
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding/brand-profile");
    });
  });
});
