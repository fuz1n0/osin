# WinHP YouTube & Live Notifier

Discord bot thông báo khi WinHP đăng video YouTube mới hoặc bắt đầu livestream trên YouTube/TikTok. Video YouTube có thể gửi vào kênh riêng và ping role riêng; thông báo live dùng `@everyone` cùng nội dung được chọn ngẫu nhiên.

## Chạy bot

1. Cài Node.js 20 trở lên.
2. Tạo bot trong Discord Developer Portal, bật **Message Content Intent** trong mục **Bot > Privileged Gateway Intents**, rồi mời bot vào server với quyền xem/gửi tin nhắn ở các kênh thông báo.
3. Sao chép `.env.example` thành `.env`, rồi điền `DISCORD_TOKEN` và ID các kênh Discord.
4. Điền link hoặc handle YouTube/TikTok. YouTube cần bật YouTube Data API v3 trong Google Cloud và điền API key.
5. Chạy `npm install`, sau đó `npm start`.

Điền `YOUTUBE_NOTIFICATION_CHANNEL_ID` cho thông báo livestream và `YOUTUBE_VIDEO_NOTIFICATION_CHANNEL_ID` cho thông báo video mới. Hai ID này độc lập; để trống ID video sẽ tắt thông báo video, không tự gửi chung vào kênh live. Điền `YOUTUBE_VIDEO_NOTIFICATION_ROLE_ID` bằng ID role Discord để ping role khi có video mới. Bot cần quyền gửi tin nhắn trong các kênh đã chọn, quyền **Mention @everyone, @here, and All Roles** cho thông báo live, và quyền mention role tương ứng cho thông báo video. Chỉ tài khoản có cấu hình đầy đủ mới được theo dõi.

Trong server Discord, gọi `osin` hoặc `ô sin` trong tin nhắn để bot trả lời mẫu. Phần AI hiện chưa bật và chưa cần API key; sau này có thể nối Google Gemini trong `bot-replies.js`.

YouTube được kiểm tra mặc định mỗi 30 phút. Tìm livestream tiêu tốn 100 quota units mỗi lần; dò video mới qua uploads playlist và kiểm tra loại video tốn rất ít quota. Livestream đang phát hoặc đã phát sẽ không bị gửi nhầm như video thường. Khi bot chạy lần đầu, video mới nhất hiện có được ghi nhận làm mốc và không gửi thông báo cho video cũ. Có thể chỉnh `YOUTUBE_POLL_INTERVAL_MS` nếu dự án Google Cloud được cấp quota cao hơn. TikTok dùng `tiktok-live-connector`, một thư viện không chính thức nên có thể bị ảnh hưởng khi TikTok thay đổi hệ thống; nếu lỗi, log sẽ có thông tin các nguồn kiểm tra dự phòng để tiện chẩn đoán.

## Deploy lên Render

1. Đẩy project lên GitHub, chọn **New > Blueprint** trên Render và kết nối repository này. Render sẽ đọc cấu hình từ `render.yaml`.
2. Điền các biến môi trường được yêu cầu khi tạo service. Không đưa token hoặc API key vào GitHub; có thể để trống các biến của nền tảng không dùng.
3. Sau khi deploy, mở `https://<ten-service>.onrender.com/` để xem trang trạng thái của bot. Trang tự cập nhật mỗi 30 giây và báo bot đã kết nối Discord hay chưa.
4. Trên UptimeRobot, tạo monitor loại **HTTP(s)** với URL `https://<ten-service>.onrender.com/health`, kiểm tra mỗi 5 phút. Endpoint trả về HTTP 200 khi Discord đã kết nối và HTTP 503 khi bot chưa sẵn sàng; có thể bật cảnh báo để biết khi health check lỗi.

Blueprint hiện dùng gói Free. UptimeRobot giúp kiểm tra endpoint và có thể đánh thức service đang ngủ, nhưng gói Free có thể sleep, cold start hoặc restart nên không đảm bảo bot chạy liên tục tuyệt đối. Nếu cần chạy 24/7 ổn định, chọn gói Render Always On trả phí.