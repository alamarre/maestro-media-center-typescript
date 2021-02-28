import "reflect-metadata";
import AWS = require("aws-sdk");
import canonicalize from "../apis/hm/canonicalize";
import { container } from "tsyringe";
import IDatabase from "../database/IDatabase";

const DYNAMO_TABLE = process.env.DYNAMO_TABLE || "maestro-media-center";
const dynamoClient = new AWS.DynamoDB.DocumentClient();
import dbFactory from "../database/DbFactory";
const db = dbFactory();
container.register<IDatabase>("IDatabase", { useValue: db });
import CollectionManager from "../features/collections/CollectionManager";

const collectionManager = container.resolve(CollectionManager);

const normalize = require("./utilities/EventNormalizer");

exports.handler = async (event, context, callback) => {
  await Promise.all(normalize(event).map(async record => {
    console.log(JSON.stringify(record));
    if (record.table === "video_sources") {
      const sortKey = record.key;
      console.log(record.eventName, sortKey);
      if (record.eventName === "INSERT") {
        console.log("adding", sortKey);
        const parts = sortKey.split("/");
        const type = parts.shift();
        const time = new Date().getTime();
        if (type === "Movies") {
          const movie = parts[0];
          console.log("adding movie data", movie);

          await Promise.all([
            db.set({ time, movie, }, "movie_added", `${time}`, movie),
            collectionManager.ensureInCollection({ itemId: movie, itemType: "Movie", href: canonicalize(`/api/hm/videos/Movies/${movie}`) }, "Movies"),
          ]);
        } else if (type === "TV Shows") {
          const show = parts[0];
          const season = parts[1];
          const episode = parts[2];
          console.log("updating show episode data", show, season, episode);

          await Promise.all([
            db.set({ time, show, season, episode }, "latest_show_episode_added", show),
            collectionManager.ensureInCollection({ itemId: show, itemType: "TV Show", href: canonicalize(`/api/hm/videos/TV Shows/${show}`), childCollectionId: `TV Seasons/${show}` }, "TV Shows"),
            collectionManager.ensureInCollection({ itemId: `${show}/${season}`, itemType: "TV Season", childCollectionId: `TV Episodes/${show}/${season}` }, `TV Seasons/${show}`),
            collectionManager.ensureInCollection({ itemId: `${show}/${season}/${episode}`, itemType: "TV Episode", href: canonicalize(`/api/hm/videos/TV Shows/${show}/${season}/${episode}`) }, `TV Episodes/${show}/${season}`)
          ]);
        }


      }
    }
  }));
  callback(null, `Successfully processed ${event.Records.length} records.`);
};