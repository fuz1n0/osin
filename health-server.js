import { createServer } from 'node:http';

export function createHealthServer(isDiscordReady) {
	return createServer((request, response) => {
		if (request.method !== 'GET') {
			response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
			response.end('Not found');
			return;
		}

		const ready = isDiscordReady();
		if (request.url === '/health') {
			response.writeHead(ready ? 200 : 503, {
				'Cache-Control': 'no-store',
				'Content-Type': 'application/json; charset=utf-8',
			});
			response.end(JSON.stringify({
				status: ready ? 'ok' : 'starting',
				discord: ready ? 'connected' : 'connecting',
			}));
			return;
		}

		if (request.url !== '/') {
			response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
			response.end('Not found');
			return;
		}

		const status = ready ? 'Đang hoạt động' : 'Đang kết nối Discord...';
		const statusColor = ready ? '#15803d' : '#b45309';
		response.writeHead(200, {
			'Cache-Control': 'no-store',
			'Content-Type': 'text/html; charset=utf-8',
		});
		response.end(`<!doctype html>
<html lang="vi">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta http-equiv="refresh" content="30">
	<title>WinHP Bot Status</title>
	<style>
		:root { color-scheme: dark; font-family: system-ui, sans-serif; }
		body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #0b1220; color: #e2e8f0; }
		main { width: min(90vw, 520px); padding: 32px; border: 1px solid #334155; border-radius: 20px; background: #111c2f; box-shadow: 0 24px 80px #0006; }
		h1 { margin-top: 0; }
		.status { color: ${statusColor}; font-size: 1.25rem; font-weight: 700; }
		a { color: #7dd3fc; }
		footer { margin-top: 24px; color: #94a3b8; font-size: .9rem; }
	</style>
</head>
<body>
	<main>
		<h1>WinHP Discord Bot</h1>
		<p>Trạng thái: <span class="status">${status}</span></p>
		<p>Discord: ${ready ? 'Đã kết nối' : 'Chưa kết nối'}</p>
		<p>Trang tự cập nhật sau mỗi 30 giây.</p>
		<footer>UptimeRobot có thể kiểm tra riêng tại <a href="/health">/health</a>.</footer>
	</main>
</body>
</html>`);
	});
}
