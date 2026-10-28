# TypeVocab

Luyện gõ tiếng Anh và học từ vựng cùng lúc. Bạn gõ lại một đoạn văn tiếng Anh. Các từ vựng mục tiêu trong đoạn được tô như bút dạ quang, và khi gõ tới (hoặc rê chuột vào) sẽ hiện nghĩa tiếng Việt, phiên âm và loại từ. Bản dịch tiếng Việt của câu đang gõ hiện ngay bên dưới để đối chiếu. Gõ xong, bạn chọn những từ muốn ôn lại.

- 50 đoạn văn, 10 đoạn cho mỗi trình độ A1, A2, B1, B2, C1.
- Từ vựng mục tiêu lấy theo cấp độ của danh sách Oxford 3000/5000.
- Không cần tài khoản: tiến độ và danh sách từ cần ôn được lưu trong trình duyệt (localStorage).

## Chạy dự án

```bash
npm install
npm run dev
```

Các lệnh khác:

| Lệnh | Việc làm |
| --- | --- |
| `npm run build` | Kiểm tra kiểu và build ra `dist/` |
| `npm run preview` | Chạy thử bản build |
| `npm test` | Kiểm tra parser và cấu trúc toàn bộ nội dung |
| `npm run lint` | Chạy oxlint |

Gợi ý khi dùng: tắt bộ gõ tiếng Việt (Unikey, EVKey...) hoặc chuyển sang chế độ gõ tiếng Anh, vì kiểu gõ Telex/VNI sẽ biến đổi chữ đang gõ.

## Cấu trúc

```
src/
  data/passages/a1.json … c1.json   nội dung đoạn văn theo trình độ
  data/index.ts                     nạp nội dung, gán id (a1-01 … c1-10)
  lib/passage.ts                    tách đoạn văn thành ký tự / từ, đánh dấu từ vựng
  lib/store.ts                      trạng thái lưu trong localStorage
  components/TypingText.tsx         phần chữ trên trang giấy, tooltip từ vựng
  components/WordPicker.tsx         chọn từ cần ôn sau khi gõ xong
  pages/Home.tsx, Practice.tsx, Review.tsx
scripts/check-oxford.mjs            đối chiếu cấp độ từ với danh sách Oxford
```

Công nghệ dùng: React 19, Vite, TypeScript, Tailwind CSS 4, React Router, Vitest.

## Thêm hoặc sửa đoạn văn

Mỗi đoạn văn trong `src/data/passages/<level>.json` có dạng:

```json
{
  "title": "A Meaningful Summer",
  "titleVi": "Một mùa hè ý nghĩa",
  "sentences": [
    { "en": "I decided to [volunteer] at an animal shelter in my [neighbourhood].", "vi": "…" },
    { "en": "The [staff] always [encouraged|encourage] me.", "vi": "…" }
  ],
  "vocab": {
    "volunteer": { "word": "volunteer", "pos": "verb", "ipa": "/ˌvɒlənˈtɪə(r)/", "vi": "tình nguyện" }
  }
}
```

- Từ mục tiêu được đánh dấu là `[từ]`. Nếu trong câu là dạng biến đổi của từ, viết `[dạng trong câu|từ gốc]`, ví dụ `[cages|cage]`.
- Mỗi từ đánh dấu phải có một mục trong `vocab` với khoá là từ gốc viết thường.
- Câu tiếng Anh chỉ dùng ký tự ASCII để gõ được trên mọi bàn phím.
- `npm test` sẽ báo lỗi nếu cấu trúc sai (thiếu nghĩa, từ đánh dấu không có trong `vocab`, quá ít hoặc quá nhiều từ mục tiêu…).

Để kiểm tra cấp độ CEFR của từ, chuẩn bị một file JSON danh sách Oxford dạng `{"word": [["B1", "n., v."]]}` rồi chạy:

```bash
node scripts/check-oxford.mjs đường/dẫn/oxford.json
```

Danh sách Oxford 3000/5000 thuộc bản quyền của Oxford University Press nên không có trong repo này.

## Triển khai

Đây là một trang tĩnh. Có thể deploy lên Vercel mà không cần cấu hình thêm (`vercel.json` đã chuyển mọi đường dẫn về `index.html` cho React Router), hoặc lên bất kỳ dịch vụ host tĩnh nào hỗ trợ SPA fallback.
