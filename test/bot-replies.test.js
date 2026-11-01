import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateAiReply, isOsinCall } from '../bot-replies.js';

test('recognizes osin calls with case, accents, and punctuation variations', () => {
	for (const content of ['osin', 'OSIN ơi', 'Ô sin ơi!', 'o sin, giúp tui', 'này, ôSIN?']) {
		assert.equal(isOsinCall(content), true, content);
	}
});

test('does not trigger when osin is part of another word', () => {
	for (const content of ['osinbot', 'myosin', 'osin_123', 'bỏ sin đi']) {
		assert.equal(isOsinCall(content), false, content);
	}
});

test('returns a placeholder reply without calling an AI service', async () => {
	assert.match(await generateAiReply('osin ơi'), /Ô sin đây/);
	assert.match(await generateAiReply('osin ơi'), /đang được chuẩn bị/);
});
