import React from "react";
import { act, render, fireEvent, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import Landing from "../src/screens/Landing";

const mockSignInWithGoogle = jest.fn();

jest.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
  }),
}));

describe("Landing (login entry)", () => {
  const navigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders welcome copy and login options", () => {
    const { getByText } = render(
      <Landing navigation={{ navigate }} />
    );

    expect(getByText("Welcome, Mama")).toBeTruthy();
    expect(getByText(/postpartum care/i)).toBeTruthy();
    expect(getByText("Continue with Google")).toBeTruthy();
    expect(getByText("Continue with Phone")).toBeTruthy();
  });

  it("navigates to LoginWithPhone when Continue with Phone is pressed", () => {
    const { getByText } = render(
      <Landing navigation={{ navigate }} />
    );

    fireEvent.press(getByText("Continue with Phone"));

    expect(navigate).toHaveBeenCalledWith("LoginWithPhone");
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
  });

  it("calls signInWithGoogle when Continue with Google is pressed", async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const { getByText } = render(
      <Landing navigation={{ navigate }} />
    );

    await act(async () => {
      fireEvent.press(getByText("Continue with Google"));
    });

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  it("shows Toast when Google sign-in fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockSignInWithGoogle.mockRejectedValue(new Error("cancelled"));
      const { getByText } = render(
        <Landing navigation={{ navigate }} />
      );

      await act(async () => {
        fireEvent.press(getByText("Continue with Google"));
      });

      await waitFor(() => {
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            text2: "Google sign-in cancelled or failed!",
          })
        );
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
