-- Đảm bảo database sử dụng bảng mã utf8mb4 chống lỗi font
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tạo bảng Danh mục sản phẩm
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tạo bảng Sản phẩm
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` bigint(20) NOT NULL,
  `image` varchar(500) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Chèn dữ liệu mẫu chuẩn Tiếng Việt và Link ảnh cục bộ
INSERT INTO `categories` (`id`, `name`) VALUES
(1, 'Điện thoại'),
(2, 'Máy tính bảng'),
(3, 'Âm thanh');

INSERT INTO `products` (`name`, `price`, `image`, `category_id`) VALUES
('iPhone 15 Pro Max 256GB', 34990000, 'http://localhost:3000/images/products/iphone15.jpg', 1),
('Samsung Galaxy S24 Ultra', 29990000, 'http://localhost:3000/images/products/s24ultra.png', 1),
('Xiaomi 14 Ultra', 22990000, 'http://localhost:3000/images/products/xiaomi14.jpg', 1);

SET FOREIGN_KEY_CHECKS = 1;