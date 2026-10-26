import type { Lang } from '../core/types';

export type { Lang } from '../core/types';
export { LANGS } from '../core/types';

/** Visitor-facing texts. Staff screens (settings, self-check) stay English and are not listed here. */
const en = {
  'attract.tagline': 'Race the musician from Stephansdom to the Riesenrad. Catch the music and dodge Krampus and the bombs.',
  'attract.cta': 'Tap anywhere to play',
  'lang.switch': 'Language',
  'item.piano': 'Piano',
  'item.violin': 'Violin',
  'item.sheet': 'Sheet music',
  'item.notes': 'Notes',
  'item.krampus': 'Krampus',
  'item.bomb': 'Bomb',
  'item.question': 'Question',
  'howto.title': 'How to play',
  'howto.lanes': 'Tap the left or right side of the screen to switch lanes.',
  'howto.items': 'Catch the music. Dodge Krampus and the bombs.',
  'howto.bonus': 'Run through a row of ❓ for a question. A right answer gives +{l1} or +{l2}.',
  'howto.go': 'Go!',
  'hud.points': 'Points',
  'hud.route': 'Stephansplatz → Riesenrad',
  'fx.noPoints': 'No points',
  'fx.go': 'Go!',
  'finish.title': 'Finish!',
  'finish.points': '{score} points',
  'question.title': 'Question {n} of {total} · Right answer = +{points}',
  'question.timeUp': "Time's up! No points this time.",
  'question.right': 'Right!',
  'question.wrong': 'Not quite. No points this time.',
  'results.score': 'Your score',
  'results.thanks': 'Thanks for playing!',
  'results.prize': 'Your prize',
  'results.hold': 'Hold for next player',
  'watchdog.restart': "Let's restart!",
  'watchdog.staff': 'Short break. Please ask the staff.',
  'board.title': 'Leaderboard',
  'board.todayTop': "Today's top 10",
  'board.allTop': 'All-time top 10',
  'board.today': 'Today',
  'board.all': 'All time',
  'board.empty': 'Be the first!',
  'board.unavailable': 'The leaderboard is unavailable right now',
  'board.offline': 'Offline · showing the saved copy',
  'board.close': 'Close',
  'results.nameHint': 'Put your code name on the leaderboard (A–Z, 0–9, up to 12)',
  'results.namePlaceholder': 'Your name',
  'results.save': 'Save',
  'results.rank': "You're #{rank} today!",
  'results.saved': 'Saved!',
  'results.viewBoard': 'See the leaderboard',
};

export type StringKey = keyof typeof en;

const vi: Record<StringKey, string> = {
  'attract.tagline': 'Cùng chàng nhạc sĩ chạy từ nhà thờ Stephansdom đến vòng đu quay Riesenrad. Nhặt nốt nhạc và nhạc cụ, né quỷ Krampus và bom.',
  'attract.cta': 'Chạm vào màn hình để chơi',
  'lang.switch': 'Ngôn ngữ',
  'item.piano': 'Đàn piano',
  'item.violin': 'Đàn vĩ cầm',
  'item.sheet': 'Bản nhạc',
  'item.notes': 'Nốt nhạc',
  'item.krampus': 'Krampus · quỷ Krampus',
  'item.bomb': 'Bom',
  'item.question': 'Câu hỏi',
  'howto.title': 'Cách chơi',
  'howto.lanes': 'Chạm vào bên trái hoặc bên phải màn hình để chuyển làn.',
  'howto.items': 'Nhặt nốt nhạc và nhạc cụ. Né quỷ Krampus và bom.',
  'howto.bonus': 'Chạy qua hàng ❓ để nhận câu hỏi. Trả lời đúng được +{l1} hoặc +{l2} điểm.',
  'howto.go': 'Chạy!',
  'hud.points': 'Điểm',
  'hud.route': 'Stephansplatz → Riesenrad',
  'fx.noPoints': 'Không có điểm',
  'fx.go': 'Chạy tiếp!',
  'finish.title': 'Về đích!',
  'finish.points': '{score} điểm',
  'question.title': 'Câu hỏi {n}/{total} · Trả lời đúng = +{points} điểm',
  'question.timeUp': 'Hết giờ! Lần này không có điểm.',
  'question.right': 'Chính xác!',
  'question.wrong': 'Chưa đúng. Lần này không có điểm.',
  'results.score': 'Điểm của bạn',
  'results.thanks': 'Cảm ơn bạn đã chơi!',
  'results.prize': 'Phần quà của bạn',
  'results.hold': 'Giữ để sang người chơi tiếp theo',
  'watchdog.restart': 'Khởi động lại nhé!',
  'watchdog.staff': 'Tạm nghỉ một chút. Vui lòng gọi nhân viên.',
  'board.title': 'Bảng xếp hạng',
  'board.todayTop': 'Top 10 hôm nay',
  'board.allTop': 'Top 10 mọi thời đại',
  'board.today': 'Hôm nay',
  'board.all': 'Tất cả',
  'board.empty': 'Hãy là người đầu tiên!',
  'board.unavailable': 'Bảng xếp hạng tạm thời không khả dụng',
  'board.offline': 'Đang ngoại tuyến · hiển thị bản đã lưu',
  'board.close': 'Đóng',
  'results.nameHint': 'Nhập biệt danh để lên bảng xếp hạng (chữ không dấu, số, tối đa 12 ký tự)',
  'results.namePlaceholder': 'Tên của bạn',
  'results.save': 'Lưu',
  'results.rank': 'Bạn đứng thứ #{rank} hôm nay!',
  'results.saved': 'Đã lưu!',
  'results.viewBoard': 'Xem bảng xếp hạng',
};

export const STRINGS: Record<Lang, Record<StringKey, string>> = { en, vi };

export type Vars = Record<string, string | number>;

/** The text for `key`, with `{name}` placeholders filled from `vars` (unknown placeholders stay as they are). */
export function translate(lang: Lang, key: StringKey, vars: Vars = {}): string {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
