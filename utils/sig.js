// take code from actual youtube source

import { cutJsFunction, getTextBetween } from "./utils.js";

const baseJsRegex = /"jsUrl":"(?<url>\/s\/player\/(?<build>[0-9a-f]*)\/player_ias\.vflset\/(?<region>[a-z]+_[A-Z]+)\/base.js)"/;

const cache = {};

const extractFunctions = async () => {
	const baseJsUrl = await getBaseJsUrl();
	const baseJs = await fetch(baseJsUrl).then((r) => r.text());

	// extract transformations used in decipher
	const extractDecipherTransformations = () => {
		if (cache.deciphTransforms) return cache.deciphTransforms;

		const transformationsFuncName = getTextBetween(baseJs, `a=a.split("");`, ".");
		if (transformationsFuncName?.length) {
			// find function declaration
			const declaration = `var ${transformationsFuncName}=`;
			const afterTransformationsFunc = baseJs.slice(baseJs.indexOf(declaration) + declaration.length);
			const transformationsFunc = `${declaration}${cutJsFunction(afterTransformationsFunc)}`;

			cache.deciphTransforms = transformationsFunc;

			return transformationsFunc;
		}
		throw new Error("Could not find decipher transformations function");
	};

	// extract decipher
	const extractDecipher = () => {
		if (cache.deciph) return cache.deciph;

		const deciphFuncName = getTextBetween(baseJs, `a.set("alr","yes");c&&(c=`, "(decodeURIComponent(c");
		if (deciphFuncName?.length) {
			// find function declaration
			const declaration = `${deciphFuncName}=function(a)`;
			const afterDeciphFunc = baseJs.slice(baseJs.indexOf(declaration) + declaration.length);
			const transformations = extractDecipherTransformations();
			const deciphFunc = `${transformations};var ${declaration}${cutJsFunction(afterDeciphFunc)};${deciphFuncName}(deciph)`;

			cache.deciph = deciphFunc;

			return deciphFunc;
		}
		throw new Error("Could not find decipher function");
	};

	// extract ncode
	const extractNcode = () => {
		if (cache.ncode) return cache.ncode;

		let ncodeFuncName = getTextBetween(baseJs, "c=a.get(b))&&(c=", "(c)");
		if (ncodeFuncName.includes("[")) {
			// it could be something like
			// var wrapperArray=[actualFunction];
			ncodeFuncName = getTextBetween(baseJs, `var ${ncodeFuncName.split("[")[0]}=[`, "]");
		}
		if (ncodeFuncName?.length) {
			// find function declaration
			const declaration = `${ncodeFuncName}=function(a)`;
			const afterNcodeFunc = baseJs.slice(baseJs.indexOf(declaration) + declaration.length);
			const ncodeFunc = `var ${declaration}${cutJsFunction(afterNcodeFunc)}`;

			cache.ncode = ncodeFunc;

			return `${ncodeFunc};${ncodeFuncName}(ncode)`;
		}
		throw new Error("Could not find ncode function");
	};

	const decipherFunction = extractDecipher();
	const ncodeFunction = extractNcode();

	return { decipher: decipherFunction, ncode: ncodeFunction };
};

const getBaseJsUrl = () => {
	const baseUrl = "https://youtube.com";
	return new Promise((resolve) => {
		fetch(baseUrl)
			.then((r) => r.text())
			.then((t) => {
				const match = t.match(baseJsRegex);
				if (!match) throw new Error("Could not find base.js url");
				resolve(baseUrl + match.groups.url);
			});
	});
};

export const decipherScript = async (text) => {
	const { decipher } = await extractFunctions();
	return eval(`var deciph=\`${text}\`;${decipher}`);
};

export const nTransformScript = async (text) => {
	const { ncode } = await extractFunctions();
	return eval(`var ncode=\`${text}\`;${ncode}`);
};
