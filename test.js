import * as fs from "node:fs";
import ytMusicDl from "./index.js";

ytMusicDl("lLwuuLIs-H0", { saveMetadata: true }).then((data) => {
	const buffer = Buffer.from(data);
	fs.writeFileSync("test.m4a", buffer);
});
