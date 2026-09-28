# Routify

**Routify** là ứng dụng web cá nhân chạy hoàn toàn cục bộ, giúp bạn quản lý thời khóa biểu, lộ trình học tập, danh sách công việc hằng ngày và đếm ngược sự kiện/kỳ thi quan trọng.

> Toàn bộ dữ liệu được lưu trên máy của bạn, không gửi ra ngoài máy chủ nào và hoạt động bình thường kể cả khi mất mạng.

## 1. Tính năng

### 1.1. Bảng điều khiển tổng quan

**Chỉ số theo dõi ngày:**

* **Bản đồ nhiệt hoạt động:** Theo dõi tần suất hoàn thành bài học và nhiệm vụ trong 6 tháng gần nhất.
* **Biểu đồ thời gian học:** Thống kê số giờ học theo ngày, tuần, tháng, năm.
* **Đánh giá tuần (Weekly Review):** Ghi chép nhanh những việc đã làm tốt, việc còn tồn đọng và định hướng cho tuần mới.

### 1.2. Lịch biểu & Phân bổ thời gian

#### 3 chế độ xem

* **Theo ngày:** Trục thời gian 24 giờ trực quan, dễ dàng theo dõi dòng sự kiện trong ngày.
* **Theo tuần:** Sắp xếp khung giờ học, làm việc và nghỉ ngơi cho cả tuần.
* **Theo tháng:** Xem trước các lịch kiểm tra, hạn chót và sự kiện trong tháng.

#### Thời khóa biểu cố định

* Nhập lịch học trên lớp, ca làm, lịch tập thể thao định kỳ theo thứ trong tuần.
* Gán màu, phòng học/địa điểm, ghi chú và biểu tượng riêng cho từng môn.
* Có sẵn mẫu tạo nhanh thời khóa biểu tuần theo mẫu tiết học.

#### Đếm ngược

Ghim kỳ thi hoặc sự kiện quan trọng nhất lên đầu trang lịch.

Có **3 dạng hiển thị**:

1. Vòng tròn tiến độ.
2. Thanh thu gọn.
3. Thẻ lật số điện tử.

### 1.3. Đếm ngược mục tiêu

* 5 kiểu giao diện thẻ đếm ngược.
* Ghim thẻ quan trọng.

### 1.4. Khóa học

#### Chế độ tính điểm học tập

* Nhận điểm kinh nghiệm (**EXP**) khi hoàn thành bài học để lên cấp.
* Có thể bật/tắt tính năng này tùy sở thích nếu chỉ muốn học tập theo cách thông thường.
* Chuyển bài học thành việc cần làm: **1-click** để đưa bài học vào danh sách việc cần làm trong ngày.

### 1.5. Danh sách công việc

#### Phân loại công việc

* **Mức độ ưu tiên:** Khẩn cấp, Cao, Trung bình, Thấp.
* **Đánh giá độ khó.**
* Hỗ trợ ghi chú **Markdown**.
* Danh sách việc con (**checklist**).
* Tệp đính kèm.

#### Cảnh báo trùng lịch

Tự động phát hiện và nhắc nhở khi bạn xếp một công việc vào khung giờ đã có tiết học hoặc lịch cố định, kèm gợi ý chọn giờ khác.

### 1.6. Nhật ký sinh hoạt & Thời gian dùng máy

* Theo dõi tâm trạng, thời lượng ngủ và mức độ bận rộn mỗi ngày.
* Ghi nhận thời gian dùng thiết bị phục vụ học tập so với giải trí.
* Đưa ra lời nhắc nghỉ ngơi khi bạn có nhiều ngày làm việc căng thẳng liên tục.

### 1.7. Thông báo qua Telegram

* Tự động gửi tin nhắn báo trước khi sắp đến tiết học hoặc hạn nộp bài.
* Báo cáo nhanh lịch trình mỗi sáng.

### 1.8. Sao lưu & Phục hồi dữ liệu

#### Lưu trữ

Ẩn các khóa học hoặc công việc đã hoàn thành để giữ bảng làm việc gọn gàng.

#### Xuất file sao lưu

Đóng gói toàn bộ:

* `lifeos.db`
* File đính kèm.
* `manifest.json`.

Thành một file `.zip`, được lưu tại:

```text
backend/storage/backups/
```

#### Phục hồi

Tự động tạo một bản sao lưu tạm thời trước khi giải nén phục hồi để tránh rủi ro mất dữ liệu.

---

## 2. Yêu cầu

Trước khi bắt đầu, hãy cài sẵn **2 công cụ** sau:

### Python

**Python 3.10 trở lên**

Tải tại [python.org](https://python.org).

> **Windows:** Nhớ tích chọn **"Add Python to PATH"** ở bước cài đặt đầu tiên.

### Node.js

**Node.js LTS 18.x hoặc 20.x trở lên**

Tải tại [nodejs.org](https://nodejs.org).

### Kiểm tra cài đặt

Mở **Terminal / Command Prompt** và chạy:

```bash
python --version
node --version
npm --version
```

---

## 3. Cài đặt

### Bước 1 — Lấy mã nguồn

#### Sử dụng Git

```bash
git clone <URL_REPOSITORY>

cd lifeos
```

Hoặc tải file `.zip` từ GitHub rồi giải nén vào một thư mục trên máy.

### Bước 2 — Cài đặt các gói phụ thuộc

Mở cửa sổ dòng lệnh tại thư mục dự án.

#### Cài Backend

```bash
cd backend

pip install -r requirements.txt

cd ..
```

#### Cài Frontend

```bash
cd frontend

npm install

cd ..
```

---

## 4. Khởi chạy

Sau khi cài đặt xong, bạn có thể chạy ứng dụng bằng một trong các cách sau.

### Cách 1 — Tiện nhất trên Windows

Nhấp đúp vào:

```text
start.bat
```

File này sẽ tự động:

* Kiểm tra cổng.
* Mở Backend.
* Mở Frontend.
* Khởi động trình duyệt.

### Cách 2 — Chạy ngầm

Nhấp đúp vào:

```text
start_hidden.bat
```

Ứng dụng sẽ chạy dưới nền và trình duyệt mở tại:

```text
http://localhost:5173
```

### Cách 3 — Sử dụng Python

Mở terminal tại thư mục gốc và chạy:

```bash
python run.py
```

### Cách 4 — Chạy thủ công

> Dành cho lập trình viên.

**Terminal 1 — Backend:**

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

### Địa chỉ truy cập

**Giao diện người dùng:**

```text
http://localhost:5173
```

**Tài liệu API — Swagger UI:**

```text
http://127.0.0.1:8000/docs
```

---

## 5. Tắt ứng dụng

### Nếu mở bằng file `.bat` hoặc chạy ngầm

Nhấp đúp vào:

```text
stop.bat
```

File này sẽ tắt sạch các tiến trình đang chiếm cổng.

### Nếu chạy bằng terminal thủ công

Nhấn:

```text
Ctrl + C
```

trên các cửa sổ terminal đang chạy Backend và Frontend.

---

## 6. Lưu ý

### Dữ liệu hoàn toàn riêng tư

Toàn bộ dữ liệu được lưu trữ cục bộ trên máy của bạn.

### Hoạt động khi mất mạng

Routify có thể hoạt động bình thường khi không có kết nối Internet.

### Quản lý cổng mạng

Mặc định hệ thống sử dụng:

| Thành phần |   Cổng |
| ---------- | -----: |
| Backend    | `8000` |
| Frontend   | `5173` |

Nếu gặp lỗi cổng đang được sử dụng:

1. Chạy `stop.bat`.
2. Mở lại Routify.

### Sao lưu định kỳ

Nên chủ động vào:

```text
Cài đặt → Xuất gói sao lưu
```

để tải file `.zip` về lưu trữ.

Hoặc có thể sao chép trực tiếp:

```text
backend/lifeos.db
```

sang một vị trí an toàn.

---

## 7. Bản quyền

Dự án được phát hành dưới giấy phép mã nguồn mở **MIT License**.

Bản quyền thuộc về:

**© 2026 Huu Quy**

Bạn có thể tự do sử dụng, chỉnh sửa và phân phối lại mã nguồn với điều kiện giữ nguyên thông tin bản quyền của tác giả.
