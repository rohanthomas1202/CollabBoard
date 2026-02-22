import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLoginWithEmail = jest.fn();
const mockSignupWithEmail = jest.fn();
const mockLoginWithGoogle = jest.fn();
let mockUser: { uid: string; email: string } | null = null;

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    loginWithEmail: mockLoginWithEmail,
    signupWithEmail: mockSignupWithEmail,
    loginWithGoogle: mockLoginWithGoogle,
    user: mockUser,
  }),
}));

import LoginPage from "../login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it("renders login form by default", () => {
    render(<LoginPage />);
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("Sign In")).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("At least 6 characters")).toBeTruthy();
  });

  it("renders CollabBoard branding", () => {
    render(<LoginPage />);
    expect(screen.getByText("CollabBoard")).toBeTruthy();
    expect(screen.getByText("Real-time collaborative whiteboard")).toBeTruthy();
  });

  it("renders Google sign-in button", () => {
    render(<LoginPage />);
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("switches to signup form", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText("Sign up"));
    // "Create Account" appears as both heading and button
    expect(screen.getAllByText("Create Account").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("Your name")).toBeTruthy();
  });

  it("switches back to login form", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText("Sign up"));
    expect(screen.getAllByText("Create Account").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText("Sign in"));
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });

  it("calls loginWithEmail on form submit", async () => {
    mockLoginWithEmail.mockResolvedValue({ user: { uid: "1" } });
    render(<LoginPage />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("you@example.com"), "test@test.com");
    await user.type(screen.getByPlaceholderText("At least 6 characters"), "password123");

    fireEvent.submit(screen.getByPlaceholderText("you@example.com").closest("form")!);

    await waitFor(() => {
      expect(mockLoginWithEmail).toHaveBeenCalledWith("test@test.com", "password123");
    });
  });

  it("calls signupWithEmail on signup form submit", async () => {
    mockSignupWithEmail.mockResolvedValue({ user: { uid: "1" } });
    render(<LoginPage />);

    fireEvent.click(screen.getByText("Sign up"));

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Your name"), "Test User");
    await user.type(screen.getByPlaceholderText("you@example.com"), "test@test.com");
    await user.type(screen.getByPlaceholderText("At least 6 characters"), "password123");

    fireEvent.submit(screen.getByPlaceholderText("you@example.com").closest("form")!);

    await waitFor(() => {
      expect(mockSignupWithEmail).toHaveBeenCalledWith("test@test.com", "password123", "Test User");
    });
  });

  it("calls loginWithGoogle on Google button click", async () => {
    mockLoginWithGoogle.mockResolvedValue({ user: { uid: "g-1" } });
    render(<LoginPage />);

    fireEvent.click(screen.getByText("Continue with Google"));

    await waitFor(() => {
      expect(mockLoginWithGoogle).toHaveBeenCalled();
    });
  });

  it("shows error message on login failure", async () => {
    mockLoginWithEmail.mockRejectedValue(new Error("Invalid credentials"));
    render(<LoginPage />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("you@example.com"), "test@test.com");
    await user.type(screen.getByPlaceholderText("At least 6 characters"), "wrong");

    fireEvent.submit(screen.getByPlaceholderText("you@example.com").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeTruthy();
    });
  });

  it("shows error message on Google sign-in failure", async () => {
    mockLoginWithGoogle.mockRejectedValue(new Error("Google error"));
    render(<LoginPage />);

    fireEvent.click(screen.getByText("Continue with Google"));

    await waitFor(() => {
      expect(screen.getByText("Google error")).toBeTruthy();
    });
  });

  it("redirects to home when user is already authenticated", () => {
    mockUser = { uid: "user-1", email: "test@test.com" };
    render(<LoginPage />);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("clears error when switching between login and signup", async () => {
    mockLoginWithEmail.mockRejectedValue(new Error("Login error"));
    render(<LoginPage />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("you@example.com"), "test@test.com");
    await user.type(screen.getByPlaceholderText("At least 6 characters"), "wrong");
    fireEvent.submit(screen.getByPlaceholderText("you@example.com").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Login error")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Sign up"));
    expect(screen.queryByText("Login error")).toBeNull();
  });

  it("has theme toggle button", () => {
    render(<LoginPage />);
    const toggleButton = screen.getByTitle("Switch to light");
    expect(toggleButton).toBeTruthy();
  });

  it("toggles theme", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByTitle("Switch to light"));
    expect(screen.getByTitle("Switch to dark")).toBeTruthy();
  });
});
