export function isOsinCall(content) {
	const normalized = content.normalize('NFD').replace(/\p{M}/gu, '');
	return /(^|[^\p{L}\p{N}_])(?:o\s*sin|osin)(?=$|[^\p{L}\p{N}_])/iu.test(normalized);
}

export async function generateAiReply(_messageContent) {
	// TODO: Connect Google Gemini after its API key is configured; keep the placeholder until then.
	return 'Dạ, Ô sin đây! 🫡\nChức năng trả lời bằng AI đang được chuẩn bị nha.';
}
