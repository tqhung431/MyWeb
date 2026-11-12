// Stage 21: the API's error messages in Vietnamese, for people who chose it (the "nook_lang" cookie the
// website sets, or the browser's Accept-Language). Routes keep throwing English; the error handler
// (middleware/errors.ts) translates on the way out. A message that isn't listed stays in English.
//
// {x} in a key matches any text (a name, a number) and is kept in the Vietnamese sentence.

import type { Request } from "express";

export type Lang = "en" | "vi";

export function langOf(req: Request): Lang {
  const cookie = req.cookies?.nook_lang;
  if (cookie === "vi" || cookie === "en") return cookie;
  for (const part of (req.get("accept-language") ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (code === "vi" || code === "en") return code;
  }
  return "en";
}

const VI: Record<string, string> = {
  // People and access
  "Pick a name first": "Hãy chọn tên trước",
  "Enter a name": "Hãy nhập tên",
  "Use 30 characters or fewer": "Tối đa 30 ký tự",
  "Someone here is already called “{name}”. Try adding an initial or an emoji.": "Ở đây đã có người tên “{name}”. Thử thêm một chữ cái hoặc một emoji.",
  "You already have a name. Use PATCH /api/me to change it.": "Bạn đã có tên rồi. Dùng PATCH /api/me để đổi.",
  "Person not found": "Không tìm thấy người này",
  "Unknown person": "Không biết người này",
  "That's you": "Đó là bạn mà",
  "Too many attempts. Please wait a few minutes.": "Bạn thử nhiều quá. Vui lòng đợi vài phút.",
  "Cross-site request blocked": "Đã chặn yêu cầu từ trang khác",
  "Uploads must come from Nook's own page": "Chỉ được tải lên từ trang của Nook",
  "Send JSON": "Hãy gửi JSON",
  "Invalid request": "Yêu cầu không hợp lệ",
  "Something went wrong": "Có lỗi xảy ra",
  "That's too big to send": "Quá lớn để gửi",
  // Hobby Hub
  "Group not found": "Không tìm thấy nhóm",
  "Post not found": "Không tìm thấy bài viết",
  "Comment not found": "Không tìm thấy bình luận",
  "Message not found": "Không tìm thấy tin nhắn",
  "There's already a group called “{name}”": "Đã có nhóm tên “{name}”",
  "Only the person who started this group can delete it": "Chỉ người tạo nhóm mới xóa được nhóm",
  "You can only delete your own posts": "Bạn chỉ xóa được bài viết của mình",
  "You can only delete your own comments": "Bạn chỉ xóa được bình luận của mình",
  "You can only delete your own messages": "Bạn chỉ xóa được tin nhắn của mình",
  "Join this group to post": "Tham gia nhóm để đăng bài",
  "Join this group to comment": "Tham gia nhóm để bình luận",
  "Join this group to chat": "Tham gia nhóm để trò chuyện",
  "Write a post": "Hãy viết bài",
  "Write a comment": "Hãy viết bình luận",
  "Write a message": "Hãy viết tin nhắn",
  "Write a group name": "Hãy đặt tên nhóm",
  "Keep it under {n} characters": "Tối đa {n} ký tự",
  "Pick an emoji": "Hãy chọn một emoji",
  "Use an emoji": "Hãy dùng emoji",
  "Choose a picture": "Hãy chọn một ảnh",
  "Picture not found": "Không tìm thấy ảnh",
  "Picture not found: send it again": "Không tìm thấy ảnh: hãy gửi lại",
  "Pictures can be up to {n} MB": "Ảnh tối đa {n} MB",
  "That isn't a picture Nook can show (JPEG, PNG, WebP or GIF)": "Nook không hiển thị được tệp này (dùng JPEG, PNG, WebP hoặc GIF)",
  // Music
  "Song not found": "Không tìm thấy bài hát",
  "Choose a song file to upload": "Hãy chọn tệp bài hát để tải lên",
  "Songs can be up to {n} MB": "Bài hát tối đa {n} MB",
  "That file isn't a song Nook can read (try MP3, M4A, OGG, FLAC or WAV)": "Nook không đọc được tệp này (thử MP3, M4A, OGG, FLAC hoặc WAV)",
  "That song is already in Nook: “{title}”": "Bài này đã có trong Nook: “{title}”",
  "Too many songs this hour ({n}). Try the rest in about {m} min.": "Quá nhiều bài trong giờ này ({n}). Thử các bài còn lại sau khoảng {m} phút.",
  "Only the person who added this song can change it": "Chỉ người thêm bài hát mới sửa được",
  "This song has no cover picture": "Bài này không có ảnh bìa",
  "Please confirm you may share this song": "Hãy xác nhận bạn được phép chia sẻ bài này",
  // Habits, books, WatchList, games
  "Habit not found": "Không tìm thấy thói quen",
  "Book not found": "Không tìm thấy sách",
  "Give it a name": "Hãy đặt tên",
  "Give the book a title": "Hãy nhập tên sách",
  "That's 30 habits already. Maybe archive a few?": "Đã có 30 thói quen rồi. Bớt vài cái nhé?",
  "You can tick today or up to 30 days back": "Bạn chỉ đánh dấu được hôm nay hoặc tối đa 30 ngày trước",
  "Log today or up to 30 days back": "Chỉ ghi được hôm nay hoặc tối đa 30 ngày trước",
  "Unknown time zone": "Múi giờ không hợp lệ",
  "Title not found": "Không tìm thấy phim",
  "Unknown title": "Không biết phim này",
  "Type at least 2 letters": "Nhập ít nhất 2 chữ cái",
  "Can't reach the TV and anime websites right now. Is this PC online?": "Hiện không kết nối được các trang phim và anime. Máy này có mạng không?",
  "Can't reach the TV and anime websites right now. Try again in a minute.": "Hiện không kết nối được các trang phim và anime. Thử lại sau một phút.",
  "Tip not found": "Không tìm thấy mẹo",
  "Unknown game": "Không biết trò chơi này",
  "That score isn't possible in this game": "Điểm này không thể có trong trò chơi",
  "No save yet": "Chưa có bản lưu",
  "The Companion is off on this Nook (no Ollama configured)": "Bạn đồng hành đang tắt trên Nook này (chưa cài Ollama)",
};

// Keys with {x} become patterns: "Keep it under {n} characters" → /^Keep it under (.+?) characters$/
const PATTERNS = Object.entries(VI)
  .filter(([en]) => en.includes("{"))
  .map(([en, vi]) => {
    const names = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const source = en
      .split(/\{\w+\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(.+?)");
    return { re: new RegExp(`^${source}$`), names, vi };
  });

export function translateMessage(message: string, lang: Lang): string {
  if (lang === "en") return message;
  if (message in VI) return VI[message];
  for (const p of PATTERNS) {
    const m = p.re.exec(message);
    if (m) return p.names.reduce((out, name, i) => out.replace(`{${name}}`, m[i + 1]), p.vi);
  }
  return message;
}
