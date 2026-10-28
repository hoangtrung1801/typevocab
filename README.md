# TypeVocab

Luyện gõ tiếng Anh và học từ vựng cùng lúc. Bạn gõ lại một đoạn văn tiếng Anh. Các từ vựng mục tiêu trong đoạn được tô như bút dạ quang, và khi gõ tới (hoặc rê chuột vào) sẽ hiện nghĩa tiếng Việt, phiên âm và loại từ. Bản dịch tiếng Việt của câu đang gõ hiện dần ngay bên dưới: gõ tới cụm tiếng Anh nào thì cụm tiếng Việt tương ứng hiện ra từng từ. Gõ xong, bạn chọn những từ muốn ôn lại.

- 6 trình độ A1–C2, khoảng 4.900 từ vựng chia theo unit và chủ đề (`data/vocab/*.csv`).
- Mỗi unit từ vựng thành một đoạn văn (hai đoạn nếu unit có hơn 8 từ), sinh bằng script với OpenAI API. Repo hiện chỉ có đoạn mẫu cho unit 1 của mỗi trình độ; chạy script để sinh phần còn lại.
- Không cần tài khoản: tiến độ và danh sách từ cần ôn được lưu trong trình duyệt (localStorage).

## Cách gõ

Logic gõ giống Monkeytype:

- Chữ gõ đúng chuyển sang màu mực, chữ sai hiện màu đỏ (vẫn hiển thị chữ đúng), chữ gõ thừa ở cuối từ hiện màu đỏ sẫm.
- Dấu cách chuyển sang từ tiếp theo. Từ đã qua mà còn lỗi được gạch chân đỏ.
- Backspace chỉ quay lại được từ trước nếu từ đó còn lỗi. Ctrl+Backspace (Alt+Backspace trên macOS) xoá cả từ.
- Esc hoặc Tab để gõ lại từ đầu. Gõ xong nhấn Enter để xem kết quả.
- Kết quả: **wpm** (chỉ tính các từ gõ đúng), **acc** (phím đúng / tổng số phím), **raw** (mọi ký tự đã gõ) và thời gian.
- Từ vựng mục tiêu nào bị gõ sai sẽ được chọn sẵn trong danh sách ôn tập.
- Âm thanh kiểu máy đánh chữ (phím, dấu cách, xoá, gõ sai, chuông khi xong) được tạo bằng Web Audio API, không cần file âm thanh. Bật/tắt bằng nút loa ở góc trên.

## Ôn tập ngắt quãng

Những từ đã chọn ôn được xếp lịch theo thuật toán SM-2 rút gọn (thuật toán của Anki), trong `src/lib/srs.ts`:

- Thẻ ôn hiện nghĩa tiếng Việt và câu gốc trong đoạn văn với từ được để trống (gợi ý chữ cái đầu). Bạn gõ từ tiếng Anh; chấp nhận cả dạng trong câu (*cages*) lẫn dạng gốc (*cage*).
- Sau khi xem đáp án, chọn mức nhớ bằng nút hoặc phím 1–4: **Quên** (ôn lại sau 10 phút, quay lại cuối buổi ôn), **Khó**, **Được**, **Dễ**. Gõ đúng thì app gợi ý sẵn "Được", gõ sai thì gợi ý "Quên".
- Khoảng cách giãn dần: 1 ngày, 3 ngày, rồi nhân với hệ số dễ (bắt đầu 2,5; giảm khi chọn Khó/Quên, tăng khi chọn Dễ).
- Mỗi buổi ôn tối đa 30 từ đến hạn. Trang chủ và trang "Từ cần ôn" hiện số từ đến hạn.

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
| `npm test` | Kiểm tra parser, script sinh đoạn và cấu trúc toàn bộ nội dung |
| `npm run generate -- --level a1` | Sinh đoạn văn bằng OpenAI API (xem bên dưới) |
| `npm run lint` | Chạy oxlint |

Gợi ý khi dùng: tắt bộ gõ tiếng Việt (Unikey, EVKey...) hoặc chuyển sang chế độ gõ tiếng Anh, vì kiểu gõ Telex/VNI sẽ biến đổi chữ đang gõ.

## Cấu trúc

```
data/vocab/a1.csv … c2.csv          bộ từ vựng: unit, từ, loại từ, nghĩa, IPA, chủ đề
src/
  data/passages/a1.json … c2.json   đoạn văn theo trình độ (do script sinh ra)
  data/topics.ts                    tên các chủ đề
  data/index.ts                     nạp nội dung
  lib/passage.ts                    tách đoạn văn thành ký tự / từ, đánh dấu từ vựng
  lib/typing.ts                     logic gõ kiểu Monkeytype
  lib/store.ts                      trạng thái lưu trong localStorage
  lib/srs.ts, lib/review.ts         lịch ôn tập ngắt quãng, thẻ ôn có chỗ trống
  components/TypingBoard.tsx        trang giấy để gõ, con trỏ, tooltip từ vựng
  components/WordPicker.tsx         kết quả và chọn từ cần ôn
  pages/Home.tsx, Practice.tsx       chọn đoạn, gõ đoạn văn
  pages/Review.tsx, ReviewSession.tsx  danh sách từ cần ôn, buổi ôn tập
scripts/generate-passages.mjs       sinh đoạn văn bằng OpenAI API
scripts/lib/passage-gen.mjs         prompt, kiểm tra và ghép kết quả của model
```

Công nghệ dùng: React 19, Vite, TypeScript, Tailwind CSS 4, React Router, Vitest.

## Sinh đoạn văn bằng OpenAI API

```bash
export OPENAI_API_KEY=sk-...
npm run generate -- --level a1 --units 1-5 --dry-run   # xem prompt, chưa gọi API
npm run generate -- --level a1 --units 1-5             # sinh thử vài unit
npm run generate -- --level all                        # sinh toàn bộ
```

Script đọc `data/vocab/<level>.csv`, lấy từng unit làm một đoạn (unit hơn 8 từ được chia đôi), gọi model với structured output, rồi ghi vào `src/data/passages/<level>.json`. Model chỉ viết câu, tiêu đề và bản dịch; nghĩa, loại từ và IPA của từ vựng luôn lấy từ file CSV.

Mỗi kết quả đều được kiểm tra: đủ mọi từ mục tiêu và đánh dấu đúng, không đánh dấu từ ngoài danh sách, câu tiếng Anh chỉ dùng ASCII, hai vế có cùng số cụm, câu dài phải chia cụm. Nếu sai, script gửi danh sách lỗi lại cho model và thử lại (mặc định tối đa 3 lần); vẫn sai thì bỏ qua đoạn đó và báo lỗi. Script lưu sau mỗi đoạn, và các đoạn đã có sẽ được giữ lại, nên khi bị ngắt giữa chừng chỉ cần chạy lại đúng lệnh cũ để làm tiếp.

| Tuỳ chọn | Ý nghĩa |
| --- | --- |
| `--level a1…c2\|all` | Trình độ cần sinh (bắt buộc) |
| `--units 1-5,8` | Chỉ sinh các unit này |
| `--limit N` | Dừng sau N đoạn mới |
| `--concurrency N` | Số request song song (mặc định 3) |
| `--retries N` | Số lần thử cho mỗi đoạn (mặc định 3) |
| `--force` | Sinh lại cả những đoạn đã có |
| `--out DIR` | Ghi vào thư mục khác thay vì `src/data/passages` |
| `--dry-run` | In prompt của đoạn đầu tiên rồi thoát, không gọi API |

| Biến môi trường | Ý nghĩa |
| --- | --- |
| `OPENAI_API_KEY` | API key (bắt buộc, trừ khi `--dry-run`) |
| `OPENAI_MODEL` | Tên model, mặc định `gpt-6-luna` |
| `OPENAI_BASE_URL` | Mặc định `https://api.openai.com/v1` |
| `OPENAI_API` | `responses` (mặc định, Responses API) hoặc `chat` (Chat Completions, cho các provider tương thích OpenAI) |

Sau khi sinh, chạy `npm test` để kiểm tra lại toàn bộ nội dung.

## Định dạng đoạn văn

Mỗi đoạn trong `src/data/passages/<level>.json` có dạng:

```json
{
  "id": "a1-u001-1",
  "unit": 1,
  "topic": "fam",
  "title": "My Aunt's Family",
  "titleVi": "Gia đình của dì tôi",
  "sentences": [
    { "en": "My [aunt] lives / in a big house.", "vi": "Dì tôi sống / trong một ngôi nhà lớn." },
    { "en": "On Sunday, / my [mum] and I / visit them.", "vi": "Vào Chủ nhật, / mẹ tôi và tôi / đến thăm họ." }
  ],
  "vocab": {
    "aunt": { "word": "aunt", "pos": "noun", "ipa": "/ænt/", "vi": "dì, cô" }
  }
}
```

- Từ mục tiêu được đánh dấu là `[từ]`. Nếu trong câu là dạng biến đổi của từ, viết `[dạng trong câu|từ gốc]`, ví dụ `[twins|twin]`.
- ` / ` chia câu thành các cụm. Cụm tiếng Anh thứ n ghép với cụm tiếng Việt thứ n, nên hai vế phải có cùng số cụm và cùng thứ tự. Khi người dùng gõ tới cụm tiếng Anh nào, cụm tiếng Việt tương ứng hiện dần từng từ.
- Câu tiếng Anh chỉ dùng ký tự ASCII để gõ được trên mọi bàn phím.
- `npm test` báo lỗi nếu cấu trúc sai, hoặc nếu từ vựng của một đoạn không khớp với unit tương ứng trong `data/vocab`.

Lưu ý: nghĩa tiếng Việt và IPA trong `data/vocab` được dịch tự động (cột `reviewed=false`), nên cần được duyệt lại.

## Triển khai

Đây là một trang tĩnh. Có thể deploy lên Vercel mà không cần cấu hình thêm (`vercel.json` đã chuyển mọi đường dẫn về `index.html` cho React Router), hoặc lên bất kỳ dịch vụ host tĩnh nào hỗ trợ SPA fallback.
