import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { IFlowDefinitionNode } from "../../api/flowDefinition.api";
import { NodeType } from "../../types/chat.types";
import { NONE_OPTION_VALUES } from "../../constants/chat";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import { styles } from "../../public/styles/profileStyles";
import CustomDatePicker from "../CustomDatePicker";

type AnswerValue = string | string[] | null;

interface Props {
  node: IFlowDefinitionNode;
  value: AnswerValue;
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
}

const NONE_VALUES = NONE_OPTION_VALUES as readonly string[];

/**
 * Renders a single editable onboarding answer, driven by the flow node's type.
 * Selected options are compared by their `value` token (which is what
 * onboarding_data stores). Patterned on components/onboarding/PHQInputRenderer,
 * styled for the light Edit Profile screen.
 */
const OnboardingAnswerInput: React.FC<Props> = ({
  node,
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const nodeType = node.nodeType as NodeType;

  if (nodeType === NodeType.QUESTION_FREE_TEXT) {
    return (
      <View style={styles.input}>
        <TextInput
          placeholderTextColor={colors.gray}
          style={[styles.inputFocusedValue, globalStyles.fontRegular]}
          placeholder={node.text}
          value={typeof value === "string" ? value : ""}
          onChangeText={onChange}
          editable={!disabled}
        />
      </View>
    );
  }

  if (nodeType === NodeType.QUESTION_DATE) {
    const dateValue =
      typeof value === "string" && !isNaN(Date.parse(value))
        ? new Date(value)
        : null;
    return (
      <View>
        <TouchableOpacity
          style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
          activeOpacity={0.7}
          disabled={disabled}
          onPress={() => setShowDatePicker(true)}
        >
          <Text
            style={[
              styles.inputFocusedValue,
              !dateValue && { color: colors.gray },
              globalStyles.fontRegular,
            ]}
          >
            {dateValue
              ? dateValue.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : t("common.selectDate")}
          </Text>
          <MaterialDesignIcons
            name="calendar-month-outline"
            color={colors.darkPurple}
            size={20}
          />
        </TouchableOpacity>
        <CustomDatePicker
          show={showDatePicker}
          setShow={setShowDatePicker}
          selectedDate={dateValue}
          onSelect={date => onChange(date.toISOString())}
          minimumDate={false}
        />
      </View>
    );
  }

  // QUESTION_SINGLE / QUESTION_MULTI
  const isMulti = nodeType === NodeType.QUESTION_MULTI;
  const selectedArray: string[] = Array.isArray(value)
    ? value
    : value
      ? [value as string]
      : [];

  const toggleMulti = (optValue: string) => {
    const isNone = NONE_VALUES.includes(optValue);
    if (selectedArray.includes(optValue)) {
      onChange(selectedArray.filter(v => v !== optValue));
      return;
    }
    if (isNone) {
      // Selecting a "none" option clears every other selection.
      onChange([optValue]);
      return;
    }
    // Selecting a real option removes any "none" option.
    onChange([...selectedArray.filter(v => !NONE_VALUES.includes(v)), optValue]);
  };

  const iconFor = (isSelected: boolean) => {
    if (isMulti) {
      return isSelected ? "checkbox-marked" : "checkbox-blank-outline";
    }
    return isSelected ? "radiobox-marked" : "radiobox-blank";
  };

  return (
    <View style={{ marginVertical: 2 }}>
      {node.options.map(opt => {
        const isSelected = selectedArray.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.8}
            disabled={disabled}
            onPress={() => (isMulti ? toggleMulti(opt.value) : onChange(opt.value))}
            style={[
              styles.optionRow,
              isSelected && styles.optionRowSelected,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
                isSelected ? globalStyles.fontMedium : globalStyles.fontRegular,
              ]}
            >
              {opt.label}
            </Text>
            <MaterialDesignIcons
              name={iconFor(isSelected)}
              color={isSelected ? colors.darkPurple : colors.gray}
              size={22}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default OnboardingAnswerInput;
