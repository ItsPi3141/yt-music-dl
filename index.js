import ID3 from "./utils/id3.js";
import { decipherScript, nTransformScript } from "./utils/sig.js";
import { parseQueryString } from "./utils/utils.js";
import { m4aToMp3 } from "./utils/convert.js";

// const SOURCE_API_URL =
// 	"https://www.youtube-nocookie.com/youtubei/v1/player?prettyPrint=false";
const SOURCE_API_URL = "https://music.youtube.com/youtubei/v1/player?prettyPrint=false";

const createFetchBody = (musicId) => {
	return JSON.stringify({
		videoId: musicId,
		context: {
			client: {
				clientName: "IOS",
				clientVersion: "19.09.3",
			},
		},
	});
};

/**
 * Returns an ArrayBuffer of the audio from a given YouTube music ID
 *
 * @typedef {Object} DownloadOptions
 * @property {boolean} saveMetadata - whether to save metadata or not
 * @property {boolean} showLogs - whether to show logs or not
 *
 * @param {string} id - description of the URL parameter
 * @param {DownloadOptions} options - description of the options parameter
 * @return {ArrayBuffer} description of the return value
 */
const ytMusicDl = async (id, options) => {
	// itag 140 is medium quality audio
	// high quality audio doesn't exist?
	const targetItag = 140;

	if (options.showLogs) console.log(`Getting info for song ID ${id}...`);

	const musicInfo = await fetch(SOURCE_API_URL, {
		method: "POST",
		credentials: "omit",
		body: createFetchBody(id),
	}).then((res) => res.json());

	if (!(musicInfo.playabilityStatus && musicInfo.playabilityStatus.status === "OK")) throw new Error("music unplayable");
	const downloadInfo = musicInfo?.streamingData?.adaptiveFormats?.find((f) => f.itag === targetItag);
	console.log(downloadInfo);
	if (options.showLogs) console.log("Download URL found!");

	let musicProtected = false;
	if (!downloadInfo?.url) {
		musicProtected = true;
	}

	const url = downloadInfo.url || downloadInfo.signatureCipher || downloadInfo.cipher;
	const decipher = (url) => {
		const args = parseQueryString(url);
		if (!args.s || !decipherScript) return args.url;
		const components = new URL(decodeURIComponent(args.url));
		components.searchParams.set(args.sp ? args.sp : "signature", decipherScript(decodeURIComponent(args.s)));
		return components.toString();
	};
	const ncode = (url) => {
		const components = new URL(decodeURIComponent(url));
		const n = components.searchParams.get("n");
		if (!n || !nTransformScript) return url;
		components.searchParams.set("n", decodeURIComponent(n));
		return components.toString();
	};
	if (musicProtected) {
		if (options.showLogs) console.log("Deciphering download URL...");
		downloadInfo.url = ncode(decipher(url));
	} else {
		downloadInfo.url = ncode(url);
	}

	const downloadUrl = downloadInfo.url;

	if (options.showLogs) console.log("Downloading...");
	console.log(downloadUrl);

	const concurrentDownloads = 8;
	const chuckSize = 1024 * 512;
	const prepareChunks = [];
	for (let i = 0; i < Math.ceil(Number.parseInt(downloadInfo.contentLength) / chuckSize); i++) {
		if (i % concurrentDownloads === 0) prepareChunks.push([]);
		prepareChunks[prepareChunks.length - 1].push(`&range=${i * chuckSize}-${i * chuckSize + chuckSize - 1}`);
	}
	const chunks = [];
	for (const downloadGroup of prepareChunks) {
		const downloadedChunks = downloadGroup.map(
			async (chunk) =>
				await fetch(`${downloadUrl}${chunk}`, {
					method: "POST",
				}).then(async (res) => await res.arrayBuffer())
		);
		await Promise.all(downloadedChunks);
		for (const dc of downloadedChunks) {
			chunks.push(await dc);
		}
	}

	const m4aSong = await new Blob(chunks).arrayBuffer();

	if (options.showLogs) console.log("Converting m4a to mp3...");
	const song = await m4aToMp3(m4aSong);
	if (options.showLogs) console.log("Conversion finished!");

	if (options.saveMetadata) {
		if (options.showLogs) console.log("Adding metadata...");
		const thumbnailUrl = musicInfo?.videoDetails?.thumbnail?.thumbnails?.[musicInfo?.videoDetails?.thumbnail?.thumbnails.length - 1]?.url;
		const metadata = new ID3(song);
		metadata
			.setFrame("TPE1", [musicInfo?.videoDetails?.author.replace(/ ? -? ?Topic/g, "")])
			.setFrame("TIT2", musicInfo?.videoDetails?.title)
			.setFrame("TYER", Number.parseInt(musicInfo?.microformat?.playerMicroformatRenderer?.publishDate.split("-")[0]))
			.setFrame("APIC", {
				type: 3,
				data: await (await fetch(thumbnailUrl)).arrayBuffer(),
				description: musicInfo?.videoDetails?.title,
			});
		metadata.addTag();
		return metadata.arrayBuffer;
	}
	return song;
};

export default ytMusicDl;
