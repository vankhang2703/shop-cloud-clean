const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = 3000;

// Cấu hình để sử dụng dữ liệu từ form và json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cho phép truy cập thư mục ảnh public
app.use(express.static(path.join(__dirname, 'public')));

// Giỏ hàng ảo lưu trên bộ nhớ Server (Dùng tạm thay cho Session để deploy Docker nhanh)
let globalCart = [];

// Cấu hình kết nối MySQL (Đảm bảo charset là utf8mb4)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'shopuser',
    password: process.env.DB_PASSWORD || 'shoppass123',
    database: process.env.DB_NAME || 'shopdb',
    charset: 'utf8mb4'
});

db.connect((err) => {
    if (err) {
        console.error('Lỗi kết nối MySQL: ' + err.stack);
        return;
    }
    console.log('Kết nối thành công đến MySQL Database.');
});

// --- API TÍNH NĂNG GIỎ HÀNG ---
// 1. Thêm sản phẩm vào giỏ
app.post('/cart/add', (req, res) => {
    const { id, name, price } = req.body;
    const existingItem = globalCart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        globalCart.push({ id, name, price: Number(price), quantity: 1 });
    }
    res.redirect('back'); // Tải lại trang hiện tại sau khi thêm thành công
});

// 2. Xóa sản phẩm khỏi giỏ
app.post('/cart/remove', (req, res) => {
    const { id } = req.body;
    globalCart = globalCart.filter(item => item.id !== id);
    res.redirect('back');
});

// 3. Làm trống giỏ hàng (Thanh toán thành công)
app.post('/cart/checkout', (req, res) => {
    globalCart = [];
    res.send(`<script>alert("Đặt hàng thành công! Cám ơn bạn đã mua sắm tại ShopCloud."); window.location.href="/";</script>`);
});


// --- GIAO DIỆN CHÍNH (Tích hợp Tìm kiếm, Lọc Danh mục, Giỏ hàng) ---
app.get('/', (req, res) => {
    const search = req.query.search || '';
    const categoryId = req.query.category || '';

    // Lấy danh sách danh mục để làm bộ lọc bên trái
    db.query('SELECT * FROM categories', (err, categories) => {
        if (err) return res.status(500).send('Lỗi lấy danh mục');

        // Xây dựng câu lệnh tìm kiếm nâng cao
        let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
        let params = [];

        if (search) {
            query += ' AND p.name LIKE ?';
            params.push(`%${search}%`);
        }
        if (categoryId) {
            query += ' AND p.category_id = ?';
            params.push(categoryId);
        }

        // Chạy lệnh lấy sản phẩm
        db.query(query, params, (err, products) => {
            if (err) return res.status(500).send('Lỗi lấy sản phẩm');

            // 1. Giao diện Danh mục bên trái
            let categoryHTML = `<a href="/" style="display:block; padding:10px; margin-bottom:5px; background:${!categoryId ? '#007bff' : '#fff'}; color:${!categoryId ? '#fff' : '#333'}; text-decoration:none; border-radius:4px; font-weight:bold;">Tất cả sản phẩm</a>`;
            categories.forEach(cat => {
                const isSelected = categoryId == cat.id;
                categoryHTML += `<a href="/?category=${cat.id}" style="display:block; padding:10px; margin-bottom:5px; background:${isSelected ? '#007bff' : '#fff'}; color:${isSelected ? '#fff' : '#333'}; text-decoration:none; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">${cat.name}</a>`;
            });

            // 2. Giao diện Danh sách sản phẩm
            let productHTML = '';
            if (products.length === 0) {
                productHTML = '<p style="text-align:center; width:100%; color:#666;">Không tìm thấy sản phẩm nào phù hợp.</p>';
            } else {
                products.forEach(prod => {
                    productHTML += `
                        <div style="border: 1px solid #eee; padding: 15px; border-radius: 8px; width: 230px; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.05); background:#fff; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <img src="${prod.image}" alt="${prod.name}" style="width: 100%; height: 160px; object-fit: contain; margin-bottom: 10px;">
                                <span style="background: #e1f0ff; color: #007bff; padding: 3px 8px; font-size: 11px; border-radius: 4px; font-weight:bold;">${prod.category_name}</span>
                                <h3 style="font-size: 14px; margin: 10px 0; color: #333; height: 40px; overflow:hidden;">${prod.name}</h3>
                                <p style="color: #ff4d4f; font-weight: bold; font-size: 16px; margin: 5px 0;">${Number(prod.price).toLocaleString('vi-VN')} đ</p>
                            </div>
                            <form action="/cart/add" method="POST" style="margin-top:10px;">
                                <input type="hidden" name="id" value="${prod.id}">
                                <input type="hidden" name="name" value="${prod.name}">
                                <input type="hidden" name="price" value="${prod.price}">
                                <button type="submit" style="width:100%; background:#007bff; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;">🛒 Thêm vào giỏ</button>
                            </form>
                        </div>
                    `;
                });
            }

            // 3. Giao diện khối Giỏ hàng bên phải
            let cartHTML = '<p style="color:#666; text-align:center;">Giỏ hàng trống</p>';
            let totalCartPrice = 0;
            let totalCartQuantity = 0;

            if (globalCart.length > 0) {
                cartHTML = '<div style="max-height: 300px; overflow-y: auto;">';
                globalCart.forEach(item => {
                    totalCartPrice += item.price * item.quantity;
                    totalCartQuantity += item.quantity;
                    cartHTML += `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px dashed #eee; padding-bottom:5px; font-size:13px;">
                            <div style="flex:1; padding-right:5px;">
                                <b>${item.name}</b><br>
                                <span style="color:#666;">${Number(item.price).toLocaleString('vi-VN')}đ x ${item.quantity}</span>
                            </div>
                            <form action="/cart/remove" method="POST">
                                <input type="hidden" name="id" value="${item.id}">
                                <button type="submit" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold;">Xóa</button>
                            </form>
                        </div>
                    `;
                });
                cartHTML += '</div>';
                cartHTML += `
                    <div style="margin-top:15px; border-top:2px solid #ddd; padding-top:10px;">
                        <p style="display:flex; justify-content:space-between; font-weight:bold;"><span>Tổng tiền:</span><span style="color:red;">${totalCartPrice.toLocaleString('vi-VN')} đ</span></p>
                        <form action="/cart/checkout" method="POST">
                            <button type="submit" style="width:100%; background:#28a745; color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:14px; margin-top:5px;">💳 Thanh toán ngay</button>
                        </form>
                    </div>
                `;
            }

            // --- TRẢ VỀ GIAO DIỆN HTML TOÀN DIỆN ---
            res.send(`
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <title>Cửa Hàng Điện Tử | ShopCloud Premium</title>
                </head>
                <body style="font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0;">
                    
                    <div style="background: #007bff; color: white; padding: 15px 50px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h1 style="margin: 0; font-size: 24px; cursor:pointer;" onclick="window.location.href='/'">☁️ ShopCloud Premium</h1>
                        
                        <form action="/" method="GET" style="display: flex; width: 40%; gap: 5px;">
                            ${categoryId ? `<input type="hidden" name="category" value="${categoryId}">` : ''}
                            <input type="text" name="search" value="${search}" placeholder="Tìm kiếm sản phẩm..." style="width: 100%; padding: 10px; border: none; border-radius: 4px; outline: none; font-size: 14px;">
                            <button type="submit" style="background: #333; color: white; border: none; padding: 0 20px; border-radius: 4px; cursor: pointer; font-weight:bold;">Tìm</button>
                        </form>

                        <div style="font-weight: bold; font-size: 16px;">
                            🛒 Giỏ hàng: <span style="background:red; color:white; padding:2px 8px; border-radius:50%; font-size:13px;">${totalCartQuantity}</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; padding: 3px 50px; margin-top:20px; align-items: flex-start;">
                        
                        <div style="width: 15%; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <h3 style="margin-top:0; color:#333; border-bottom:2px solid #007bff; padding-bottom:5px;">📁 Danh mục</h3>
                            ${categoryHTML}
                        </div>

                        <div style="width: 60%;">
                            <h2 style="margin-top:0; color:#333; font-size:20px;">
                                ${search ? `🔍 Kết quả tìm kiếm cho "${search}"` : '🔥 Tất cả sản phẩm'} 
                                <span style="font-size:14px; background:#ccc; color:#fff; padding:2px 6px; border-radius:10px; margin-left:5px;">${products.length}</span>
                            </h2>
                            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                                ${productHTML}
                            </div>
                        </div>

                        <div style="width: 25%; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); position: sticky; top: 20px;">
                            <h3 style="margin-top:0; color:#333; border-bottom:2px solid #28a745; padding-bottom:5px;">🛒 Chi tiết đơn hàng</h3>
                            ${cartHTML}
                        </div>

                    </div>
                </body>
                </html>
            `);
        });
    });
});
// --- TÍNH NĂNG ADMIN: THÊM SẢN PHẨM ---

// 1. Giao diện trang quản lý của Admin (http://localhost:3000/admin)
app.get('/admin', (req, res) => {
    // Lấy danh sách danh mục để hiển thị trong thẻ <select> của Form
    db.query('SELECT * FROM categories', (err, categories) => {
        if (err) return res.status(500).send('Lỗi tải danh mục');

        let categoryOptions = '';
        categories.forEach(cat => {
            categoryOptions += `<option value="${cat.id}">${cat.name}</option>`;
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <title>Trang Quản Trị Admin | ShopCloud</title>
            </head>
            <body style="font-family: Arial, sans-serif; background: #f4f6f9; padding: 40px; display: flex; justify-content: center;">
                <div style="background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 450px;">
                    <h2 style="color: #007bff; text-align: center; margin-top: 0;">➕ THÊM SẢN PHẨM MỚI (ADMIN)</h2>
                    <p style="text-align: center; color: #666; font-size: 13px;">Dữ liệu sẽ được lưu trực tiếp vào database MySQL</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    
                    <form action="/admin/add-product" method="POST">
                        <div style="margin-bottom: 15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">Tên sản phẩm:</label>
                            <input type="text" name="name" required placeholder="Ví dụ: iPad Pro M4" style="width:93%; padding:10px; border:1px solid #ddd; border-radius:4px;">
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">Giá bán (đ):</label>
                            <input type="number" name="price" required placeholder="Ví dụ: 28990000" style="width:93%; padding:10px; border:1px solid #ddd; border-radius:4px;">
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">Danh mục:</label>
                            <select name="category_id" style="width:98%; padding:10px; border:1px solid #ddd; border-radius:4px; background:#fff;">
                                ${categoryOptions}
                            </select>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">Tên file ảnh (đã lưu trong thư mục products):</label>
                            <input type="text" name="image_name" required placeholder="Ví dụ: ipad.jpg" style="width:93%; padding:10px; border:1px solid #ddd; border-radius:4px;">
                        </div>

                        <button type="submit" style="width:100%; background:#28a745; color:white; border:none; padding:12px; border-radius:4px; font-size:16px; font-weight:bold; cursor:pointer;">💾 Lưu Sản Phẩm</button>
                    </form>
                    
                    <div style="text-align:center; margin-top: 20px;">
                        <a href="/" style="color:#007bff; text-decoration:none; font-size:14px;">← Quay lại Trang Chủ xem Web</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    });
});

// 2. API đón nhận dữ liệu từ Form Admin và chèn vào Database MySQL
app.post('/admin/add-product', (req, res) => {
    const { name, price, category_id, image_name } = req.body;
    
    // Tự động ghép nối thành đường dẫn ảnh nội bộ chuẩn
    const fullImageUrl = `http://localhost:3000/images/products/${image_name}`;

    const sql = 'INSERT INTO products (name, price, image, category_id) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, price, fullImageUrl, category_id], (err, result) => {
        if (err) {
            console.error('Lỗi chèn database: ', err);
            return res.status(500).send('Lỗi hệ thống, không thể lưu sản phẩm.');
        }
        // Thêm thành công thì bắn thông báo Alert và đẩy Admin về trang chủ để xem kết quả
        res.send(`<script>alert("Thêm sản phẩm thành công!"); window.location.href="/";</script>`);
    });
});
app.listen(PORT, () => {
    console.log(`Server Premium đang chạy mượt mà tại http://localhost:${PORT}`);
});