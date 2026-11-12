// Stage 21: error messages in the visitor's language
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { translateMessage } from "../src/i18n.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

describe("messages in Vietnamese", () => {
  it("follows the nook_lang cookie, then the browser's language", async () => {
    const vi = await request(app).post("/api/hobby/groups/cooking/posts").set("Cookie", "nook_lang=vi").send({ body: "x" });
    expect(vi.body.error).toBe("Hãy chọn tên trước");
    const viBrowser = await request(app).get("/api/hobby/groups/nope").set("Accept-Language", "vi-VN,vi;q=0.9");
    expect(viBrowser.body.error).toBe("Không tìm thấy nhóm");
    const en = await request(app).get("/api/hobby/groups/nope").set("Cookie", "nook_lang=en").set("Accept-Language", "vi");
    expect(en.body.error).toBe("Group not found");
  });

  it("translates check messages and keeps names and numbers", async () => {
    const agent = request.agent(app);
    await agent.post("/api/me").send({ name: "Linh" });
    const taken = await request(app).post("/api/me").set("Cookie", "nook_lang=vi").send({ name: "linh" });
    expect(taken.body.error).toBe("Ở đây đã có người tên “linh”. Thử thêm một chữ cái hoặc một emoji.");
    await agent.put("/api/hobby/groups/books/membership");
    const long = await agent
      .post("/api/hobby/groups/books/posts")
      .set("Cookie", "nook_lang=vi")
      .send({ body: "x".repeat(4001) });
    expect(long.body.details[0].message).toBe("Tối đa 4000 ký tự");
    expect(translateMessage("A message nobody wrote", "vi")).toBe("A message nobody wrote");
  });
});
