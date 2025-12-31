import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import React, { Dispatch } from 'react';
import { TextInput, View } from 'react-native';
import { colors } from '../public/assets/colors';
import { globalStyles } from "../public/styles";

interface ISearchInputProps {
    setSearchData: Dispatch<React.SetStateAction<string>>;
    marginBottom?: number;
}


const SearchInput = ({ setSearchData, marginBottom }: ISearchInputProps) => {
    return (
        <View
            style={{
                borderColor: colors.purple,
                borderWidth: 2,
                marginBottom: marginBottom || 30,
                borderRadius: 20,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 10
            }}
        >
            <TextInput
                inputMode="text"
                placeholderTextColor={colors.black}
                cursorColor={colors.black}
                placeholder={"Search"}
                selectTextOnFocus={true}
                style={[{
                    paddingVertical: 15,
                    paddingHorizontal: 20,
                    color: colors.black,
                    flex: 1
                }, globalStyles.fontRegular]}
                onChangeText={(text) => setSearchData(text)}
            />
            <MaterialDesignIcons name="magnify" color={colors.black} size={24} />
        </View>
    )
}

export default SearchInput