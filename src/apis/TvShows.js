const logger = require("../impl/logger").logger("TvShowsApi");

class TvShowsApi {
  constructor(db, router) {
    this.router = router;
    this.init();
    this.db = db;
  }

  async listShowsInProgress(ctx) {
    ctx.body = await this.db.list("user_data", ctx.username, ctx.profile, "tv_shows_keep_watching");
  }

  async listRecentShows(ctx) {
    ctx.body = await this.db.list("latest_show_episode_added");
  }

  async postShowProgress(ctx) {
    const obj = ctx.request.body;
    obj.lastUpdated = new Date().getTime();
    logger.info("updated keep watching", obj);
    await this.db.set(obj, "user_data", ctx.username, ctx.profile, "tv_shows_keep_watching", obj.show);
    ctx.body = { result: "OK", };
  }

  init() {
    this.router.get("/keep-watching", this.listShowsInProgress.bind(this));
    this.router.post("/keep-watching", this.postShowProgress.bind(this));
    this.router.get("/recent", this.listRecentShows.bind(this));
  }
}

module.exports = TvShowsApi;
