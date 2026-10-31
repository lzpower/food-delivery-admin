# SubiFood Admin — điều phối tài xế

Đã chuyển luồng phân công sang backend xác thực theo tài liệu bàn giao. Chỉ chỉnh food-delivery-admin, không chỉnh app khách hoặc SQL Supabase.

## Chức năng

- Đăng nhập email/mật khẩu Supabase. Backend xác minh JWT bằng auth.getUser rồi kiểm tra UUID trong ADMIN_USER_IDS.
- Xem 100 đơn mới nhất, chi tiết món/người nhận, trạng thái chuyến và lý do sự cố.
- Danh sách tài xế chỉ gồm role driver, approval_status approved và không có chuyến hoạt động (kể cả offered). Có nhãn online/offline; vẫn được gửi đề nghị cho người offline như hợp đồng database.
- Phân công qua admin_driver_assign, không UPDATE delivering và không gửi thông báo giả đang giao.
- Chặn bấm lặp, báo xung đột từ RPC, tải lại đơn/tài xế sau thao tác. Thành công phân công không biến thành thất bại chỉ vì tải danh sách lỗi.
- Tiếp nhận đơn qua backend, chỉ đổi pending thành preparing nếu đơn chưa thay đổi.
- Tài xế hoàn thành/COD trên app; không có nút admin cập nhật completed trực tiếp.
- Xử lý ngoại lệ qua admin_driver_resolve: trả về điều phối hoặc hủy, nhập lý do và xác nhận trả món khi cần. Database vẫn kiểm tra cuối cùng.
- Polling mỗi 10 giây, ngừng tải khi ẩn trang, không chồng request; abort khi unmount/logout.

## 1. Cấu hình

Đã tạo file trống .env.local và server/.env.local để điền. File .env.example ở hai nơi là mẫu, không chứa khóa thật.

Frontend .env.local:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Backend server/.env.local:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ADMIN_USER_IDS=
PORT=3001
```

- Hai URL cùng project Supabase đang dùng, hai public key là publishable hoặc anon key.
- SUPABASE_SECRET_KEY chỉ dùng ở server: secret key hoặc service_role key. Không thêm tiền tố VITE, không dán vào src.
- Chọn/tạo một tài khoản Auth dành cho quản trị; lấy User UID từ Supabase Authentication → Users rồi điền ADMIN_USER_IDS. Nhiều UUID phân cách bằng dấu phẩy. Không dùng UUID tài xế để lách kiểm tra.
- Không cần role admin trong profiles, không tin metadata.role do người dùng sửa.
- Khóa quyền cao nhúng trong phiên bản frontend cũ đã bị loại khỏi source mới. Người quản lý cần thu hồi/thay khóa cũ nếu đã phát hành/chia sẻ và cập nhật các backend hợp lệ đang dùng; xóa khỏi code không tự thu hồi khóa.

## 2. Chạy local

Trong folder food-delivery-admin:

```powershell
npm install
```

Terminal 1:

```powershell
npm run dev:server
```

Terminal 2:

```powershell
npm run dev
```

Mở URL Vite, đăng nhập tài khoản có UUID quản trị. Frontend gọi /api qua proxy đến http://127.0.0.1:3001. Backend mặc định chỉ lắng nghe localhost.

Không cần chạy lại hai migration database tài xế. Chúng phải đã được quản lý cài đặt; tài xế cũng phải được duyệt approved. Nếu không có tài xế rảnh thì hãy duyệt tài xế hoặc đợi chuyến trước kết thúc.

## 3. Phân công và kiểm thử thực tế

1. Tạo đơn mới từ app khách. Admin tiếp nhận hoặc phân công ngay khi pending/preparing.
2. Chọn tài xế rảnh → Phân công tài xế. Database tạo offered, đơn preparing. Giao diện hiển thị hạn nhận thực tế từ expires_at.
3. Tài xế bật online, nhận → đến quán → lấy món; database mới chuyển delivering.
4. Tài xế đến khách và xác nhận giao/COD; database hoàn tất và ghi sổ tiền cùng giao dịch.
5. Với sự cố, bấm Xử lý ngoại lệ / đổi tài xế; sau khi kiểm tra thực tế mới xác nhận. Trả về điều phối sẽ mở lại danh sách chọn tài xế. Không tự giả định thu tiền/hoàn tiền.
6. Hai admin gán cùng tài xế: RPC/unique index có thể trả 409. Danh sách rảnh chỉ là gợi ý tại lúc tải.

Các đơn cũ đã có driver_id nhưng chưa có assignment cần quản lý chuyển riêng bằng admin_driver_migrate_order theo tài liệu database, không tự chuyển hàng loạt.

## 4. Phạm vi các mục cũ

Cấp tài khoản tài xế và quản lý quán/thực đơn tạm ẩn theo hướng dẫn bàn giao vì chưa chuyển toàn bộ CRUD sang backend. Component cũ lưu dưới docs/legacy/*.reference.txt để đối chiếu, không được import vào ứng dụng. Không khôi phục service_role vào frontend để bật các mục này. Duyệt tài xế hiện do quản lý database/backend riêng thực hiện.

## 5. Kiểm tra và triển khai

```powershell
npm run build
npm run lint
npm test
```

Test API dùng client Supabase giả lập: kiểm tra 401/403, UUID, RPC phân công, xung đột 409, whitelist thao tác, danh sách rảnh và xử lý sự cố. Chưa gọi Supabase thật hoặc thử đăng nhập trên tài khoản thật vì chưa được cung cấp cấu hình quản trị.

Khi triển khai, cần backend Node thật và reverse proxy cùng domain: /api tới backend, đường dẫn khác tới frontend; bật HTTPS. Chỉ upload dist lên static hosting sẽ không có API. Cấu hình bind/port theo hạ tầng, giữ secret và ADMIN_USER_IDS trong môi trường server.

Không log token, password hoặc key. API dùng no-store. Supabase logout có thể không vô hiệu ngay JWT đang còn hạn; cần thiết kế kiểm tra session riêng nếu hệ thống yêu cầu thu hồi tức thời.
