import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHealthServer } from '../health-server.js';

const servers = [];

after(async () => {
	await Promise.all(servers.map((server) => new Promise((resolve, reject) => {
		server.close((error) => error ? reject(error) : resolve());
	})));
});

async function startServer(ready) {
	const server = createHealthServer(() => ready);
	servers.push(server);
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	return `http://127.0.0.1:${server.address().port}`;
}

test('root serves a status page while Discord is connecting', async () => {
	const baseUrl = await startServer(false);
	const response = await fetch(baseUrl);
	const body = await response.text();

	assert.equal(response.status, 200);
	assert.match(response.headers.get('content-type'), /text\/html/);
	assert.match(body, /WinHP Discord Bot/);
	assert.match(body, /Đang kết nối Discord/);
	assert.match(body, /href="\/health"/);
});

test('health endpoint reflects Discord readiness', async () => {
	const baseUrl = await startServer(false);
	const startingResponse = await fetch(`${baseUrl}/health`);
	assert.equal(startingResponse.status, 503);
	assert.deepEqual(await startingResponse.json(), {
		status: 'starting',
		discord: 'connecting',
	});

	const readyUrl = await startServer(true);
	const readyResponse = await fetch(`${readyUrl}/health`);
	assert.equal(readyResponse.status, 200);
	assert.deepEqual(await readyResponse.json(), {
		status: 'ok',
		discord: 'connected',
	});
});

test('unknown paths return 404', async () => {
	const baseUrl = await startServer(true);
	const response = await fetch(`${baseUrl}/unknown`);
	assert.equal(response.status, 404);
	assert.equal(await response.text(), 'Not found');
});
