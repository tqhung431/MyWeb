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
  "Enter the passcode": "Hãy nhập mã",
  "There's no admin passcode on this Nook": "Nook này chưa đặt mã quản trị",
  "That passcode isn't right": "Mã không đúng",
  "Only the admin can do this": "Chỉ quản trị viên mới làm được việc này",
  "Paste a YouTube link": "Hãy dán một liên kết YouTube",
  "Pick a shelf": "Hãy chọn một kệ",
  "That isn't a YouTube video or playlist link": "Đó không phải liên kết video hay danh sách phát YouTube",
  "That video is already on Nook TV": "Video này đã có trên Nook TV",
  "Video not found": "Không tìm thấy video",
  "Game not found": "Không tìm thấy ván cờ",
  "That result isn't possible": "Kết quả này không thể xảy ra",
  "You can't build there": "Không xây được ở đây",
  "That's your partner's side": "Đó là phía của bạn cùng chơi",
  "There's already a defender there": "Ở đó đã có người canh",
  "Not enough coins": "Không đủ xu",
  "That defender is gone": "Người canh đó không còn nữa",
  "That's your partner's defender": "Đó là người canh của bạn cùng chơi",
  "It's as strong as it gets": "Đã mạnh nhất rồi",
  "Pick an upgrade": "Hãy chọn một hướng nâng cấp",
  "A wave is already coming": "Một đợt đang kéo đến rồi",
  "Those moves aren't a valid chess game": "Các nước đi này không hợp lệ",
  "That game isn't over yet": "Ván cờ chưa kết thúc",
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
  // Stage 28
  "You can only edit your own messages": "Bạn chỉ sửa được tin nhắn của mình",
  "Messages can only be edited for 10 minutes": "Chỉ sửa được tin nhắn trong 10 phút",
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
  // Stage 27: PINs, signing in, the admin
  "A PIN is 4 to 6 digits": "Mã PIN gồm 4 đến 6 chữ số",
  "That name was used here recently. Pick another one for now.": "Tên này vừa được dùng ở đây. Tạm thời hãy chọn tên khác.",
  "That name and PIN don't match": "Tên và mã PIN không khớp",
  "That name has no PIN yet, so it can only be used on its own device. Ask the admin for a sign-in code.": "Tên này chưa có mã PIN nên chỉ dùng được trên thiết bị của nó. Hãy xin quản trị viên một mã đăng nhập.",
  "Too many wrong PINs for this name. Try again in 15 minutes.": "Nhập sai mã PIN quá nhiều lần. Thử lại sau 15 phút.",
  "That code doesn't work. Codes work once, and only for a short time.": "Mã này không dùng được. Mỗi mã chỉ dùng một lần, trong thời gian ngắn.",
  "The admin passcode is too short (it needs 16 characters or more), so admin is switched off": "Mã quản trị quá ngắn (cần từ 16 ký tự), nên chức năng quản trị đang tắt",
  // Stage 29
  "Admin isn't enabled on this Nook": "Chức năng quản trị chưa được bật trên Nook này",
  "Admin isn't available on this connection": "Không thể dùng chức năng quản trị qua kết nối này",
  "Wrong passcode": "Sai mã",
  "Join this group to see its posts and chat": "Hãy tham gia nhóm để xem bài đăng và trò chuyện",
  "Become admin over https: open Nook at https://localhost, through Tailscale or through the tunnel": "Hãy trở thành quản trị viên qua https: mở Nook ở https://localhost, qua Tailscale hoặc qua đường hầm",
  "The admin paused you for now. You can still read everything.": "Quản trị viên đang tạm khóa bạn. Bạn vẫn đọc được mọi thứ.",
  "The admin locked this group: you can read it, but not post or chat": "Quản trị viên đã khóa nhóm này: bạn đọc được nhưng không đăng bài hay trò chuyện được",
  "That person isn't here any more": "Người này không còn ở đây nữa",
  "You can't pause yourself here": "Bạn không thể tự tạm khóa mình ở đây",
  "You can't delete yourself here": "Bạn không thể tự xóa mình ở đây",
  "Type their name exactly to delete them": "Hãy gõ đúng tên người đó để xóa",
  "That's gone already": "Nội dung đó đã bị xóa rồi",
  "That's yours: you can delete it yourself": "Đó là của bạn: bạn có thể tự xóa",
  "Report not found": "Không tìm thấy báo cáo",
  "Score not found": "Không tìm thấy điểm",
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
