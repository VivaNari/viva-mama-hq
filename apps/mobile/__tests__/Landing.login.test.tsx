import React from "react";
import { act, render, fireEvent, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import Landing from "../src/screens/Landing";

const mockSignInWithGoogle = jest.fn();

jest.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
  }),
  CURRENT_VERSIONS: { PRIVACY_POLICY: "1.0.0", TERMS_OF_USE: "1.0.0" },
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

    expect(getByText("Welcome Mama")).toBeTruthy();
    expect(getByText("Care that comes to you, anytime and anywhere")).toBeTruthy();
    expect(getByText("Continue with Google")).toBeTruthy();
    expect(getByText("Continue with Phone")).toBeTruthy();
  });

  it("navigates to LoginWithPhone once the disclaimer is accepted", () => {
    const { getByText } = render(
      <Landing navigation={{ navigate }} />
    );

    // Both login methods now gate behind a one-time medical disclaimer modal
    // before proceedWithLogin() runs.
    fireEvent.press(getByText("Continue with Phone"));
    fireEvent.press(getByText("I Understand"));

    expect(navigate).toHaveBeenCalledWith("LoginWithPhone");
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
  });

  it("calls signInWithGoogle once the disclaimer and both consent checkboxes are accepted", async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const { getByText, UNSAFE_getAllByProps } = render(
      <Landing navigation={{ navigate }} />
    );

    fireEvent.press(getByText("Continue with Google"));
    fireEvent.press(getByText("I Understand"));

    // The consent modal's Continue button stays disabled until both the privacy
    // and age checkboxes are checked; re-query since checking one drops it out of
    // this "still unchecked" query.
    fireEvent.press(UNSAFE_getAllByProps({ name: "checkbox-blank-outline" })[0]);
    fireEvent.press(UNSAFE_getAllByProps({ name: "checkbox-blank-outline" })[0]);

    await act(async () => {
      fireEvent.press(getByText("Continue"));
    });

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  it("shows Toast when Google sign-in fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockSignInWithGoogle.mockRejectedValue(new Error("cancelled"));
      const { getByText, UNSAFE_getAllByProps } = render(
        <Landing navigation={{ navigate }} />
      );

      fireEvent.press(getByText("Continue with Google"));
      fireEvent.press(getByText("I Understand"));
      fireEvent.press(UNSAFE_getAllByProps({ name: "checkbox-blank-outline" })[0]);
      fireEvent.press(UNSAFE_getAllByProps({ name: "checkbox-blank-outline" })[0]);

      await act(async () => {
        fireEvent.press(getByText("Continue"));
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
