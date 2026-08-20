"use client";

import { useState } from "react";
import StarPickerTemplate from "./star-picker.mdx";

export function StarPicker({
	value,
	onChange,
}: {
	value: number;
	onChange: (n: number) => void;
}) {
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
