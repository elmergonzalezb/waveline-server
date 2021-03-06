import { getType } from "mime";
import { TrackModel } from "../Models/track.model";
import { Context, IContext, Resource, Get } from "@wellenline/via";
import { readFileSync, statSync } from "fs";
@Resource("/tracks")
export class Tracks {
	@Get("/")
	public async tracks(@Context("query") query: {
		skip?: number,
		limit?: number,
		shuffle?: boolean,
		genre?: string,
		favourites?: boolean,
		artist?: string,
		album?: string,
	}) {
		const lookup: { genre?: string, favourited?: boolean, artists?: string, album?: string } = {};
		query.skip = query.skip || 0;
		query.limit = query.limit || 20;

		if (query.genre) {
			lookup.genre = query.genre;
		}

		if (query.artist) {
			lookup.artists = query.artist;
		}

		if (query.favourites) {
			lookup.favourited = true;
		}

		if (query.album) {
			lookup.album = query.album;
		}
		const model = TrackModel.find(lookup).populate([{
			path: "album",
			populate: [{
				path: "artist",
			}],
		}, {
			path: "genre",
		}, {
			path: "artists",

		}]).sort("-created_at");

		const total = await TrackModel.countDocuments(lookup);

		if (query.skip && !query.shuffle) {
			model.skip(query.skip);
		}

		if (query.limit && !query.shuffle) {
			model.limit(query.limit);
		}

		let tracks = await model;

		if (query.shuffle) {
			const min = 0;
			const n = [];

			for (let i = 0; i < query.limit; i++) {
				n.push(Math.floor(Math.random() * (tracks.length - min + 1)) + min);
			}

			tracks = n.map((i) => tracks[i]).filter((s) => s !== null);
		}
		return {
			tracks,
			query,
			total,
		};

	}

	@Get("/play/:id")
	public async stream(@Context() context: IContext) {
		const track = await TrackModel.findById(context.params.id);
		if (!track) {
			throw new Error("Failed to load track metadata");
		}
		track.plays = track.plays + 1;
		track.last_play = new Date();

		await track.save();
		const audio = readFileSync(track.path);
		const stat = statSync(track.path);

		context.headers = {
			"Content-Type": getType(track.path),
			"Accept-Ranges": "bytes",
			"Content-Length": stat.size,
		};

		return audio;
	}

	@Get("/like/:id")
	public async like(@Context("params") params: { id: string }) {
		const track = await TrackModel.findById(params.id);
		track.favourited = !track.favourited;
		track.updated_at = new Date();
		return await track.save();

	}

	@Get("/favourites")
	public async favourites() {
		return await TrackModel.find({ favourited: true }).populate("album genre artists");

	}

	@Get("/new")
	public async recent(@Context("query") query: { limit: number }) {
		return await TrackModel.find().sort({ created_at: -1 }).populate([{
			path: "album",
			populate: [{
				path: "artist",
			}],
		}, {
			path: "genre",
		}, {
			path: "artists",

		}]).limit(query.limit || 10);
	}

	@Get("/random")
	public async random(@Context("query") query: { total: number }) {
		return await TrackModel.random(query.total);
	}

}
