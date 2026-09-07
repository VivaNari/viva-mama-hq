import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import LoginwithPhone from "../src/screens/LoginwithPhone";

// LoginwithPhone calls useNavigation() directly (unlike Landing, which takes
// navigation as a prop), so it needs a real NavigationContainer ancestor.
const renderWithNavigation = (ui: React.ReactElement) =>
  render(<NavigationContainer>{ui}</NavigationContainer>);

jest.mock("react-native-otp-entry", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return {
    OtpInput: ({
      onTextChange,
    }: {
      onTextChange: (text: string) => void;
    }) => (
      <TextInput
        testID="otp-input"
        placeholder="otp-placeholder"
        onChangeText={onTextChange}
      />
    ),
  };
});

const mockRequestPhoneOTP = jest.fn();
const mockVerifyPhoneOTP = jest.fn();

jest.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({
    requestPhoneOTP: mockRequestPhoneOTP,
    verifyPhoneOTP: mockVerifyPhoneOTP,
  }),
  CURRENT_VERSIONS: { PRIVACY_POLICY: "1.0.0", TERMS_OF_USE: "1.0.0" },
}));

// Send OTP stays disabled until both the privacy and age consent checkboxes are
// checked (on top of a valid phone number) — re-query since checking one drops
// it out of this "still unchecked" query.
const checkBothConsents = (
  UNSAFE_getAllByProps: (props: Record<string, unknown>) => any[],
) => {
  fireEvent.press(UNSAFE_getAllByProps({ name: "checkbox-blank-outline" })[0]);
  fireEvent.press(UNSAFE_getAllByProps({ name: "checkbox-blank-outline" })[0]);
};

describe("LoginwithPhone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders phone field and Send OTP", () => {
    const { getByPlaceholderText, getByText } = renderWithNavigation(<LoginwithPhone />);

    expect(getByPlaceholderText("Enter Phone Number")).toBeTruthy();
    expect(getByText("Send OTP")).toBeTruthy();
  });

  it("requests OTP and shows OTP step on success", async () => {
    mockRequestPhoneOTP.mockResolvedValue({
      success: true,
      verification_key: "vk-123",
    });

    const { getByPlaceholderText, getByText, getByTestId, UNSAFE_getAllByProps } =
      renderWithNavigation(<LoginwithPhone />);

    fireEvent.changeText(getByPlaceholderText("Enter Phone Number"), "9876543210");
    checkBothConsents(UNSAFE_getAllByProps);
    fireEvent.press(getByText("Send OTP"));

    await waitFor(() => {
      expect(mockRequestPhoneOTP).toHaveBeenCalledWith("9876543210");
    });

    expect(getByTestId("otp-input")).toBeTruthy();
    expect(getByText("Submit")).toBeTruthy();
  });

  it("calls verifyPhoneOTP on Submit with phone, otp, verification key, and consents", async () => {
    mockRequestPhoneOTP.mockResolvedValue({
      success: true,
      verification_key: "vk-abc",
    });
    mockVerifyPhoneOTP.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText, getByTestId, UNSAFE_getAllByProps } =
      renderWithNavigation(<LoginwithPhone />);

    fireEvent.changeText(getByPlaceholderText("Enter Phone Number"), "9000000000");
    checkBothConsents(UNSAFE_getAllByProps);
    fireEvent.press(getByText("Send OTP"));

    await waitFor(() => {
      expect(getByTestId("otp-input")).toBeTruthy();
    });

    fireEvent.changeText(getByTestId("otp-input"), "123456");
    fireEvent.press(getByText("Submit"));

    await waitFor(() => {
      expect(mockVerifyPhoneOTP).toHaveBeenCalledWith(
        "9000000000",
        "123456",
        "vk-abc",
        [
          { type: "privacy_policy", version: "1.0.0" },
          { type: "terms_of_use", version: "1.0.0" },
        ]
      );
    });
  });

  it("does not advance to OTP step when requestPhoneOTP returns success false", async () => {
    mockRequestPhoneOTP.mockResolvedValue({
      success: false,
      verification_key: null,
    });

    const { getByPlaceholderText, getByText, queryByTestId, UNSAFE_getAllByProps } =
      renderWithNavigation(<LoginwithPhone />);

    fireEvent.changeText(getByPlaceholderText("Enter Phone Number"), "9000000000");
    checkBothConsents(UNSAFE_getAllByProps);
    fireEvent.press(getByText("Send OTP"));

    await waitFor(() => {
      expect(mockRequestPhoneOTP).toHaveBeenCalled();
    });

    expect(queryByTestId("otp-input")).toBeNull();
  });
});
