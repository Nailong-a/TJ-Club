const fs = require('fs');
const path = require('path');
const http = require('http');
const PORT = 3000;

// 确保订单目录存在
const ORDERS_DIR = path.join(__dirname, 'orders');
if (!fs.existsSync(ORDERS_DIR)) {
  fs.mkdirSync(ORDERS_DIR);
}

// 打手数据
const players = [
  {
    id: 'player1',
    name: '闪电侠',
    level: '不朽',
    type: '突击型',
   擅长段位: ['铂金', '钻石', '大师', '不朽'],
    价格系数: 1.2
  },
  {
    id: 'player2',
    name: '鹰眼',
    level: '大师',
    type: '狙击型',
    擅长段位: ['黄金', '铂金', '钻石', '大师'],
    价格系数: 1.0
  },
  {
    id: 'player3',
    name: '堡垒',
    level: '大师',
    type: '防御型',
    擅长段位: ['白银', '黄金', '铂金', '钻石'],
    价格系数: 0.9
  },
  {
    id: 'player4',
    name: '神医',
    level: '钻石',
    type: '辅助型',
    擅长段位: ['青铜', '白银', '黄金', '铂金'],
    价格系数: 0.8
  }
];

// 段位层级
const levelHierarchy = {
  '青铜': 1,
  '白银': 2,
  '黄金': 3,
  '铂金': 4,
  '钻石': 5,
  '大师': 6,
  '不朽': 7
};

// 推荐打手函数
function recommendPlayer(order) {
  const currentLevel = order.currentLevel;
  const targetLevel = order.targetLevel;
  const serviceType = order.serviceType;

  // 根据段位和服务类型推荐合适的打手
  const suitablePlayers = players.filter(player => {
    // 检查打手是否擅长当前段位到目标段位的范围
    const currentLevelIndex = levelHierarchy[currentLevel];
    const targetLevelIndex = levelHierarchy[targetLevel];
    const playerMinLevelIndex = Math.min(...player.擅长段位.map(l => levelHierarchy[l]));
    const playerMaxLevelIndex = Math.max(...player.擅长段位.map(l => levelHierarchy[l]));

    return currentLevelIndex >= playerMinLevelIndex && targetLevelIndex <= playerMaxLevelIndex;
  });

  // 如果有合适的打手，按价格系数排序（从低到高）
  if (suitablePlayers.length > 0) {
    suitablePlayers.sort((a, b) => a.价格系数 - b.价格系数);
    return suitablePlayers[0]; // 返回价格最低的合适打手
  }

  // 如果没有完全匹配的，返回段位最高的打手
  return players.sort((a, b) => levelHierarchy[b.level] - levelHierarchy[a.level])[0];
}

// 读取所有订单
function readOrders() {
  try {
    const files = fs.readdirSync(ORDERS_DIR);
    const orders = [];

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(ORDERS_DIR, file);
        const data = fs.readFileSync(filePath, 'utf8');
        orders.push(JSON.parse(data));
      }
    });

    // 按时间戳排序（最新的在前）
    return orders.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('读取订单失败:', error);
    return [];
  }
}

// 保存订单
function saveOrder(order) {
  try {
    // 生成订单ID
    const orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const timestamp = Date.now();

    // 推荐打手
    const recommendedPlayer = recommendPlayer(order);

    // 构建完整订单对象
    const completeOrder = {
      id: orderId,
      timestamp,
      status: 'pending', // 待处理
      recommendedPlayer: recommendedPlayer ? recommendedPlayer.name : '系统自动匹配',
      ...order
    };

    // 保存到文件
    const filePath = path.join(ORDERS_DIR, `${orderId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(completeOrder, null, 2), 'utf8');

    return completeOrder;
  } catch (error) {
    console.error('保存订单失败:', error);
    throw error;
  }
}

// 更新订单状态
function updateOrderStatus(orderId, status) {
  try {
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      throw new Error('找不到订单');
    }

    orders[orderIndex].status = status;
    const filePath = path.join(ORDERS_DIR, `${orderId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(orders[orderIndex], null, 2), 'utf8');

    return orders[orderIndex];
  } catch (error) {
    console.error('更新订单状态失败:', error);
    throw error;
  }
}

// 创建服务器
const server = http.createServer((req, res) => {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 解析请求体
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    // 处理订单提交
    if (req.url === '/submit-order' && req.method === 'POST') {
      try {
        const orderData = JSON.parse(body);
        const savedOrder = saveOrder(orderData);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: '订单提交成功',
          order: savedOrder
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: '订单提交失败: ' + error.message
        }));
      }
      return;
    }

    // 处理获取订单列表
    if (req.url === '/admin/orders' && req.method === 'GET') {
      try {
        const orders = readOrders();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          orders
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: '获取订单失败: ' + error.message
        }));
      }
      return;
    }

    // 处理更新订单状态
    if (req.url.startsWith('/admin/orders/') && req.method === 'PUT') {
      try {
        const orderId = req.url.split('/')[3];
        const { status } = JSON.parse(body);

        if (!status) {
          throw new Error('请提供订单状态');
        }

        const updatedOrder = updateOrderStatus(orderId, status);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: '订单状态更新成功',
          order: updatedOrder
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: '更新订单状态失败: ' + error.message
        }));
      }
      return;
    }

    // 提供静态文件
    let filePath = '.' + req.url;
    if (filePath === './') {
      filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.woff': 'application/font-woff',
      '.ttf': 'application/font-ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'application/font-otf',
      '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          fs.readFile('./404.html', (error, content) => {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          });
        } else {
          res.writeHead(500);
          res.end('服务器错误: ' + error.code + '\n');
          res.end();
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`后台管理页面: http://localhost:${PORT}/admin.html`);
  console.log(`请确保已安装Node.js，并在浏览器中访问以上地址`);
});