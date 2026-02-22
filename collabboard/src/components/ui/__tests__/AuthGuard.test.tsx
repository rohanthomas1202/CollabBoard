import React from "react";
import { render, screen } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = jest.fn();
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

import AuthGuard from "../AuthGuard";

describe("AuthGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading spinner while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("redirects to login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "user-1", email: "test@test.com" },
      loading: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Protected Content")).toBeTruthy();
  });

  it("does not redirect while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("renders null when not loading and no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    const { container } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // After redirect effect, it returns null
    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});
