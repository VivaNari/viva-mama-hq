import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import LoginwithPhone from "../src/screens/LoginwithPhone";

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
}));

describe("LoginwithPhone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders phone field and Send OTP", () => {
    const { getByPlaceholderText, getByText } = render(<LoginwithPhone />);

    expect(getByPlaceholderText("Enter Phone Number")).toBeTruthy();
    expect(getByText("Send OTP")).toBeTruthy();
  });

  it("requests OTP and shows OTP step on success", async () => {
    mockRequestPhoneOTP.mockResolvedValue({
      success: true,
      verification_key: "vk-123",
    });

    const { getByPlaceholderText, getByText, getByTestId } = render(
      <LoginwithPhone />
    );

    fireEvent.changeText(getByPlaceholderText("Enter Phone Number"), "9876543210");
    fireEvent.press(getByText("Send OTP"));

    await waitFor(() => {
      expect(mockRequestPhoneOTP).toHaveBeenCalledWith("9876543210");
    });

    expect(getByTestId("otp-input")).toBeTruthy();
    expect(getByText("Submit")).toBeTruthy();
  });

  it("calls verifyPhoneOTP on Submit with phone, otp, and verification key", async () => {
    mockRequestPhoneOTP.mockResolvedValue({
      success: true,
      verification_key: "vk-abc",
    });
    mockVerifyPhoneOTP.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText, getByTestId } = render(
      <LoginwithPhone />
    );

    fireEvent.changeText(getByPlaceholderText("Enter Phone Number"), "9000000000");
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
        "vk-abc"
      );
    });
  });

  it("does not advance to OTP step when requestPhoneOTP returns success false", async () => {
    mockRequestPhoneOTP.mockResolvedValue({
      success: false,
      verification_key: null,
    });

    const { getByPlaceholderText, getByText, queryByTestId } = render(
      <LoginwithPhone />
    );

    fireEvent.changeText(getByPlaceholderText("Enter Phone Number"), "9000000000");
    fireEvent.press(getByText("Send OTP"));

    await waitFor(() => {
      expect(mockRequestPhoneOTP).toHaveBeenCalled();
    });

    expect(queryByTestId("otp-input")).toBeNull();
  });
});
