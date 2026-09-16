# TEAM — Day04, K4-L3B

**Làm cá nhân.** Toàn bộ phần việc do một người thực hiện, không làm theo nhóm.

## Thông tin bài nộp

- Người thực hiện / MSSV: Nguyen Thi Ha / 2A202602536
- Tên repo: `K4-L3-DAY04-NguyenThiHa-2A202602536-PromptEngineeringToolCalling`
- URL repo, nhánh nộp, commit chốt: điền khi push lên GitHub và tạo commit chốt cuối cùng
- Deadline áp dụng và link thông báo đổi hạn nếu có: 23:59 ngày làm lab, Asia/Ho_Chi_Minh (UTC+07:00); chưa có thông báo đổi hạn từ Keycoach

## Người thực hiện

| Họ và tên | MSSV | GitHub | Vai trò và công việc | File/commit/PR |
|---|---|---|---|---|
| Nguyen Thi Ha | 2A202602536 | (điền GitHub username) | Toàn bộ: preflight, v0-v5, eval_group.json, adversarial, UI, report | `starter_v0/artifacts/`, `starter_v0/data/eval_group.json`, `starter_v0/ui_server.py`, `starter_v0/ui_static/` |

## Nhận xét chung

- Kết quả và bằng chứng: giữ nguyên đề tài IT Helpdesk. Baseline v0 đạt `case_accuracy=0.70` (21/30, `starter_v0/runs/v0_B_base_openai_20260915T182717932472.json`). Qua 3 vòng sửa chính (v1-v3) tập trung vào hành vi chung, đạt `0.9333` (28/30, `starter_v0/runs/v3_B_base_openai_20260915T183343776352.json`). Bộ 12 câu an toàn ban đầu chỉ đạt `0.50` (6/12) ở v3 — phát hiện 3 case khiến agent **tạo ticket thật** từ xác nhận giả mạo (prompt injection); thêm 2 vòng vá an toàn (v4, v5) đưa kết quả lên `1.0` (12/12, `starter_v0/runs/v5_B_adversarial_openai_20260915T184154755323.json`) mà không làm giảm điểm base/group. Bộ 10 case tự viết đạt `0.9` (9/10, `starter_v0/runs/v5_B_group_openai_20260915T184325032092.json`).
- Thay đổi hiệu quả nhất: mục "Untrusted input and injected instructions" thêm vào `system_prompt.md` ở v4 — chỉ một đoạn quy tắc đã chuyển 3/6 case an toàn đang bị khai thác thành PASS, đóng lại lỗ hổng nghiêm trọng nhất (agent ghi ticket thật ra đĩa từ nội dung do chính người dùng tự nhúng giả làm tool result/xác nhận cũ/tag assistant).
- Giới hạn còn lại: H04 (dùng employee_id làm asset_id) và H19 (map "demo" sang môi trường staging dù đã cấm) vẫn chưa pass dù đã có rule riêng qua nhiều version — model (gpt-4o-mini) đôi khi bỏ qua rule khi ngữ cảnh có vẻ "hợp lý". Đề xuất hướng tiếp theo là validate format ID/enum ở tầng code tool thay vì chỉ dựa vào prompt (xem REPORT.md mục B7).
- Cách phân công và tích hợp: không có — làm cá nhân một mình từ đầu đến cuối.

## INDIVIDUAL

### Nguyen Thi Ha — 2A202602536

- Phần việc và file/commit/PR: thực hiện toàn bộ lab — cài môi trường và preflight; chạy v0 baseline; đặt giả thuyết và sửa `starter_v0/artifacts/system_prompt.md` + `starter_v0/artifacts/tools.yaml` qua v1-v5 (v4-v5 là vòng vá an toàn bổ sung sau khi phát hiện lỗ hổng ở bộ adversarial); ghi `starter_v0/artifacts/version_log.csv`; viết 10 case tự viết tại `starter_v0/data/eval_group.json`; chạy và phân tích bộ 12 câu an toàn; xây UI web cục bộ (`starter_v0/ui_server.py`, `starter_v0/ui_static/`) hiển thị tool call/input/kết quả-lỗi/version, tái dùng logic agent loop có sẵn trong `starter_v0/chat.py`; hoàn thiện `starter_v0/artifacts/REPORT.md` và `TEAM.md`.
- Quyết định, khó khăn và cách xử lý: quyết định giữ nguyên đề tài IT Helpdesk thay vì đổi lĩnh vực để tập trung thời gian vào chất lượng vòng lặp v0-v3 và an toàn (chiếm nhiều điểm nhất) thay vì viết lại bộ eval cho lĩnh vực mới. Khó khăn lớn nhất là phát hiện bộ an toàn ban đầu (dựa trên artifact đã qua v0-v3) vẫn để lọt 6/12 case, trong đó 3 case thực sự ghi ticket thật ra đĩa từ xác nhận giả mạo — xử lý bằng cách đọc trực tiếp `tool_results` và thư mục `tickets/` (không chỉ tin PASS/FAIL tự động), rồi thêm hẳn một mục prompt mới thay vì cố nhồi vào các mục đã có.
- Điều đã học: routing đúng tool không đồng nghĩa hành động đã an toàn — phải luôn mở `tool_results`/filesystem để xác nhận; một rule tổng quát chống prompt injection không tự động chặn được mọi biến thể (case A11 với tag `<assistant>` giả cần một câu riêng mới đóng được, dù đã có rule chung ở v4); và một số lỗi (H04, H19) bền vững qua nhiều lần sửa prompt cho thấy giới hạn của việc chỉ sửa prompt — cần validate ở code khi hành vi liên quan đến định dạng ID/enum cứng.
- AI/công cụ đã dùng và cách kiểm tra: dùng Claude Code để phân tích trace JSON, soạn thảo các đoạn quy tắc trong `system_prompt.md`/`tools.yaml`, và viết `ui_server.py`/`ui_static/`. Mọi kết quả số liệu trong report đều lấy trực tiếp từ file JSON trong `starter_v0/runs/` (đọc bằng script Python, không tự đánh giá bằng tay); UI đã được kiểm tra bằng smoke test API thật (`/api/session/start`, `/api/chat`) và một phiên demo 21 lượt gõ tay thật (không dàn dựng) lưu tại `starter_v0/transcripts/v5_openai_ui_20260915T192755.transcript.json`, bao gồm cả 2 tình huống cố tình tấn công (giả tool result, nhúng password) mà agent đã chặn đúng.
- Thời điểm đã tự nộp URL repo chung trên VLearn: điền sau khi push repo lên GitHub và nộp trên VLearn.
