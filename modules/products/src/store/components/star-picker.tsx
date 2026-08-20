"use client";

import { useState } from "react";
import StarPickerTemplate from "./star-picker.mdx";

export interface StarPickerProps {
	value: number;
	onChange: (n: number) => void;
}

export function StarPicker({ value, onChange }: StarPickerProps) {
	const [hover, setHover] = useState(0);
	return (
		<StarPickerTemplate
			value={value}
			hover={hover}
			onChange={onChange}
			onHover={setHover}
		/>
	);
}
