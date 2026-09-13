import RNDateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { Dispatch, Fragment, SetStateAction } from 'react'

interface ICustomDatePickerProps {
    show: boolean;
    setShow: Dispatch<SetStateAction<boolean>>;
    selectedDate: Date | null;
    onSelect: (date: Date) => void;
    /**
     * Earliest selectable date.
     *
     * `true` means "not before today" and `false`/omitted means no floor — the original
     * boolean contract, kept because the consultation booking sheet relies on it. A Date
     * sets an explicit floor, which is what a bounded range like a child's date of birth
     * (born already, but under five) needs.
     */
    minimumDate?: boolean | Date;
    maximumDate?: Date;
}

const resolveMinimumDate = (minimumDate: boolean | Date | undefined): Date | undefined => {
    if (minimumDate instanceof Date) return minimumDate;
    return minimumDate ? new Date() : undefined;
};

const CustomDatePicker = ({
    show,
    setShow,
    selectedDate,
    onSelect,
    minimumDate = false,
    maximumDate
}: ICustomDatePickerProps) => {

    const handleChange = (event: DateTimePickerEvent, date?: Date) => {
        setShow(false);

        if (event.type === "set" && date) {
            onSelect(date);
        }
    };

    return (
        <Fragment>
            {show && (
                <RNDateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={handleChange}
                    minimumDate={resolveMinimumDate(minimumDate)}
                    maximumDate={maximumDate}
                />
            )}
        </Fragment>
    );
};

export default CustomDatePicker;