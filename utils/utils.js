export const parseQueryString = (url) => {
	return (url.split("?")[1] || url)?.split("&").reduce((a, b) => {
		a[b.split("=")[0]] = b.split("=")[1];
		return a;
	}, {});
};

export const getTextBetween = (text, start, end) => {
	const after = text.substring(text.indexOf(start) + start.length);
	return after.substring(0, after.indexOf(end));
};

export const cutJsFunction = (text) => {
	let openBrackets = 0;
	let isInString = false;
	let highestStringChar = "";
	let isInRegex = false;
	for (let i = 0; i < text.length; i++) {
		if (!isInString && !isInRegex && ['"', "'", "`"].includes(text[i])) {
			isInString = true;
			highestStringChar = text[i];
		} else if (isInString && !isInRegex && text[i] === highestStringChar && text[i - 1] !== "\\") {
			isInString = false;
			highestStringChar = "";
		} else if (text[i] === "/" && (text[i - 1] === "," || isInRegex) && !isInString) {
			isInRegex = !isInRegex;
		} else if (!isInRegex && !isInString) {
			if (text[i] === "{") openBrackets++;
			if (text[i] === "}") openBrackets--;
		}

		if (openBrackets === 0) return text.substring(0, i + 1);
	}
};
