import { decipherScript, nTransformScript } from "./utils/sig.js";
import { parseQueryString } from "./utils/utils.js";

const SOURCE_API_URL =
	"https://www.youtube-nocookie.com/youtubei/v1/player?prettyPrint=false";

const createFetchBody = (videoId) => {
	return JSON.stringify({
		videoId: videoId,
		context: {
			client: {
				clientName: "WEB_EMBEDDED_PLAYER",
				clientVersion: "2.20210622.10.00",
			},
			thirdParty: {
				embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
			},
		},
		playbackContext: {
			contentPlaybackContext: {
				signatureTimestamp: 19821, // from youtube build 45986ce4
			},
		},
	});
};

/**
 * Returns an ArrayBuffer of the audio from a given YouTube video ID
 *
 * @typedef {Object} DownloadOptions
 * @property {boolean} saveMetadata - whether to save metadata
 *
 * @param {string} id - description of the URL parameter
 * @param {DownloadOptions} options - description of the options parameter
 * @return {ArrayBuffer} description of the return value
 */
const ytMusicDl = async (id, options) => {
	// itag 140 is medium quality audio
	// high quality audio doesn't exist?
	const targetItag = 140;

	const videoInfo = await fetch(SOURCE_API_URL, {
		method: "POST",
		credentials: "omit",
		body: createFetchBody(id),
	}).then((res) => res.json());

	if (
		!(
			videoInfo.playabilityStatus &&
			videoInfo.playabilityStatus.status === "OK"
		)
	)
		throw new Error("Video unplayable");

	const downloadInfo = videoInfo?.streamingData?.adaptiveFormats?.find(
		(f) => f.itag === targetItag
	);

	let videoProtected = false;
	if (!downloadInfo?.url) {
		videoProtected = true;
	}

	if (videoProtected) {
		const decipher = (url) => {
			const args = parseQueryString(url);
			if (!args.s || !decipherScript) return args.url;
			const components = new URL(decodeURIComponent(args.url));
			components.searchParams.set(
				args.sp ? args.sp : "signature",
				decipherScript(decodeURIComponent(args.s))
			);
			return components.toString();
		};
		const ncode = (url) => {
			const components = new URL(decodeURIComponent(url));
			const n = components.searchParams.get("n");
			if (!n || !nTransformScript) return url;
			components.searchParams.set(
				"n",
				nTransformScript(decodeURIComponent(n))
			);
			return components.toString();
		};
		const url =
			downloadInfo.url ||
			downloadInfo.signatureCipher ||
			downloadInfo.cipher;
		downloadInfo.url = ncode(decipher(url));
	}

	const downloadUrl = downloadInfo.url;

	const chuckSize = 1024 * 256;
	const prepareChunks = [];
	for (
		let i = 0;
		i < Math.ceil(Number.parseInt(downloadInfo.contentLength) / chuckSize);
		i++
	) {
		prepareChunks.push(
			`&range=${i * chuckSize}-${i * chuckSize + chuckSize - 1}`
		);
	}
	const downloadedChunks = prepareChunks.map(
		async (chunk) =>
			await fetch(`${downloadUrl}${chunk}`).then(
				async (res) => await res.arrayBuffer()
			)
	);
	await Promise.all(downloadedChunks);
	const chunks = [];
	for (const i in downloadedChunks) {
		chunks.push(await downloadedChunks[i]);
	}
	return await new Blob(chunks).arrayBuffer();
};

export default ytMusicDl;
