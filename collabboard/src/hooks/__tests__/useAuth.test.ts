import { renderHook, act } from "@testing-library/react";

// Mock firebase/auth before importing useAuth
const mockOnAuthStateChanged = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignInWithPopup = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  GoogleAuthProvider: jest.fn(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  getAuth: jest.fn(() => ({})),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
}));

import { useAuth } from "../useAuth";

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return jest.fn();
    });
  });

  it("starts with loading true", () => {
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
  });

  it("sets user to null when not authenticated", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("sets user when authenticated", () => {
    const mockUser = { uid: "user-1", email: "test@test.com", displayName: "Test" };
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const unsubscribe = jest.fn();
    mockOnAuthStateChanged.mockImplementation(() => unsubscribe);

    const { unmount } = renderHook(() => useAuth());
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("loginWithEmail calls signInWithEmailAndPassword", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: "1" } });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.loginWithEmail("test@test.com", "password");
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith({}, "test@test.com", "password");
  });

  it("signupWithEmail creates account and updates profile", async () => {
    const mockUser = { uid: "new-1" };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockUpdateProfile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signupWithEmail("new@test.com", "password", "New User");
    });

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith({}, "new@test.com", "password");
    expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: "New User" });
  });

  it("loginWithGoogle calls signInWithPopup", async () => {
    mockSignInWithPopup.mockResolvedValue({ user: { uid: "g-1" } });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.loginWithGoogle();
    });

    expect(mockSignInWithPopup).toHaveBeenCalled();
  });

  it("logout calls signOut", async () => {
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("exposes all expected methods", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("loading");
    expect(result.current).toHaveProperty("loginWithEmail");
    expect(result.current).toHaveProperty("signupWithEmail");
    expect(result.current).toHaveProperty("loginWithGoogle");
    expect(result.current).toHaveProperty("logout");
  });
});
