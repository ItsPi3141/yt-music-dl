// from youtube build 45986ce4

export const decipherScript = (sig) => {
	const transformations = {
		swapElementAtPos: (array, position) => {
			const temp = array[0];
			array[0] = array[position % array.length];
			array[position % array.length] = temp;
		},
		reverseArray: (array) => {
			array.reverse();
		},
		spliceArray: (array, position) => {
			array.splice(0, position);
		},
	};
	const transform = (text) => {
		const a = text.split("");
		transformations.reverseArray(a, 12);
		transformations.spliceArray(a, 3);
		transformations.swapElementAtPos(a, 13);
		transformations.reverseArray(a, 40);
		transformations.spliceArray(a, 2);
		transformations.swapElementAtPos(a, 13);
		transformations.spliceArray(a, 1);
		transformations.swapElementAtPos(a, 55);
		transformations.spliceArray(a, 1);
		return a.join("");
	};
	return transform(sig);
};

export const nTransformScript = (ncode) => {
	return `enhanced_except_7ZoBkuX-_w8_${ncode}`;
};
